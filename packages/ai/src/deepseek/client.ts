import { randomUUID } from "node:crypto";
import { redactSecrets } from "@aeta/shared";
import { DeepSeekApiError, DeepSeekConfigurationError, DeepSeekTimeoutError } from "./errors.js";
import { resolveDeepSeekBaseUrl, resolveDeepSeekModel } from "./models.js";
import { parseSseStream } from "./streaming.js";
import type { DeepSeekChatRequest, DeepSeekChatResponse, DeepSeekClientConfig, DeepSeekRequestLog, DeepSeekStreamChunk } from "./types.js";

export class DeepSeekClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly logger?: DeepSeekClientConfig["logger"];

  constructor(config: DeepSeekClientConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.baseUrl = resolveDeepSeekBaseUrl(config.baseUrl);
    this.model = resolveDeepSeekModel(config.model);
    this.timeoutMs = config.timeoutMs ?? 90_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.logger = config.logger;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(request: DeepSeekChatRequest): Promise<{ response: DeepSeekChatResponse; log: DeepSeekRequestLog }> {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const model = request.model ?? this.model;
    try {
      const response = await this.postJson<DeepSeekChatResponse>("/chat/completions", { ...request, model, stream: false }, requestId);
      const usage = response.usage;
      const log: DeepSeekRequestLog = {
        requestId,
        model: response.model || model,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        durationMs: Date.now() - startedAt,
        status: "success"
      };
      this.logger?.info("DeepSeek chat completed", log);
      return { response, log };
    } catch (error) {
      this.logger?.error("DeepSeek chat failed", redactSecrets({ requestId, model, error }));
      throw error;
    }
  }

  async *streamChat(request: DeepSeekChatRequest): AsyncGenerator<{ chunk: DeepSeekStreamChunk; requestId: string; model: string }, DeepSeekRequestLog | undefined> {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const model = request.model ?? this.model;
    let lastUsage: DeepSeekStreamChunk["usage"];
    try {
      const response = await this.fetchWithRetry("/chat/completions", { ...request, model, stream: true }, requestId);
      if (!response.body) throw new DeepSeekApiError(response.status, "DeepSeek streaming response did not include a body.");
      for await (const chunk of parseSseStream(response.body)) {
        if (chunk.usage) lastUsage = chunk.usage;
        yield { chunk, requestId, model };
      }
      const log: DeepSeekRequestLog = {
        requestId,
        model,
        inputTokens: lastUsage?.prompt_tokens,
        outputTokens: lastUsage?.completion_tokens,
        totalTokens: lastUsage?.total_tokens,
        durationMs: Date.now() - startedAt,
        status: "success"
      };
      this.logger?.info("DeepSeek stream completed", log);
      return log;
    } catch (error) {
      this.logger?.error("DeepSeek stream failed", redactSecrets({ requestId, model, error }));
      throw error;
    }
  }

  private async postJson<T>(path: string, body: unknown, requestId: string): Promise<T> {
    const response = await this.fetchWithRetry(path, body, requestId);
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new DeepSeekApiError(response.status, safeDeepSeekMessage(data, response.status), data);
    return data as T;
  }

  private async fetchWithRetry(path: string, body: unknown, requestId: string): Promise<Response> {
    if (!this.apiKey) throw new DeepSeekConfigurationError();
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.apiKey}`,
            "x-aeta-request-id": requestId
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < this.maxRetries) {
          await sleep(backoff(attempt));
          attempt += 1;
          continue;
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          let parsed: unknown = text;
          try { parsed = text ? JSON.parse(text) : undefined; } catch { /* keep text */ }
          throw new DeepSeekApiError(response.status, safeDeepSeekMessage(parsed, response.status), parsed);
        }
        return response;
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof DeepSeekApiError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          if (attempt < this.maxRetries) {
            await sleep(backoff(attempt));
            attempt += 1;
            continue;
          }
          throw new DeepSeekTimeoutError();
        }
        lastError = error;
        if (attempt < this.maxRetries) {
          await sleep(backoff(attempt));
          attempt += 1;
          continue;
        }
      }
    }
    throw new DeepSeekApiError(502, "Unable to connect to DeepSeek API.", redactSecrets(lastError));
  }
}

function safeDeepSeekMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const maybe = data as { error?: { message?: string }; message?: string };
    return String(redactSecrets(maybe.error?.message || maybe.message || `DeepSeek API returned HTTP ${status}.`));
  }
  return `DeepSeek API returned HTTP ${status}.`;
}

function backoff(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
