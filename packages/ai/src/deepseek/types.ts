export type DeepSeekRole = "system" | "user" | "assistant" | "tool";

export type DeepSeekMessage = {
  role: DeepSeekRole;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
  reasoning_content?: string;
};

export type DeepSeekTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
};

export type DeepSeekToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  index?: number;
};

export type DeepSeekChatRequest = {
  messages: DeepSeekMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: DeepSeekTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  reasoning_effort?: "low" | "medium" | "high";
  thinking?: { type: "enabled" | "disabled" };
};

export type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
};

export type DeepSeekChatChoice = {
  index: number;
  message: DeepSeekMessage;
  finish_reason: string | null;
};

export type DeepSeekChatResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: DeepSeekChatChoice[];
  usage?: DeepSeekUsage;
};

export type DeepSeekStreamChunk = {
  id?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: Partial<DeepSeekMessage> & { tool_calls?: DeepSeekToolCall[] };
    finish_reason?: string | null;
  }>;
  usage?: DeepSeekUsage;
};

export type DeepSeekClientConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: { info(message: string, meta?: unknown): void; warn(message: string, meta?: unknown): void; error(message: string, meta?: unknown): void };
};

export type DeepSeekRequestLog = {
  requestId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs: number;
  status: "success" | "error";
};
