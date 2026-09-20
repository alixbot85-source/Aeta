import { DeepSeekClient, type DeepSeekMessage } from "@aeta/ai";
import type { AgentToolCallLog, AgentToolContext, AgentToolName } from "./tools.js";
import { agentTools, executeAgentTool } from "./tools.js";

export type AgentRunOptions = {
  request: string;
  contextPrompt?: string;
  workspaceRoot: string;
  workspaceId?: string;
  allowCommands?: boolean;
  allowGitWrite?: boolean;
  allowFileMutations?: boolean;
  terminalTail?: string;
  maxIterations?: number;
};

export type AgentRunResult = {
  finalMessage: string;
  plan?: string;
  toolCalls: AgentToolCallLog[];
  pendingChanges: AgentToolContext["pendingChanges"];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; durationMs?: number; requestId?: string; model?: string };
};

export class DeepSeekAgentRunner {
  constructor(private readonly client = new DeepSeekClient()) {}

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const toolCalls: AgentToolCallLog[] = [];
    const context: AgentToolContext = {
      workspaceRoot: options.workspaceRoot,
      workspaceId: options.workspaceId,
      allowCommands: options.allowCommands,
      allowGitWrite: options.allowGitWrite,
      allowFileMutations: options.allowFileMutations,
      terminalTail: options.terminalTail,
      pendingChanges: [],
      runningServers: new Map()
    };
    const messages: DeepSeekMessage[] = [
      { role: "system", content: systemPrompt() },
      { role: "user", content: `${options.contextPrompt ? `Project context:\n${options.contextPrompt}\n\n` : ""}User request:\n${options.request}` }
    ];
    let finalMessage = "";
    let usage: AgentRunResult["usage"];
    for (let iteration = 0; iteration < (options.maxIterations ?? 8); iteration += 1) {
      const { response, log } = await this.client.chat({
        messages,
        tools: agentTools,
        tool_choice: "auto",
        reasoning_effort: "medium",
        thinking: { type: "enabled" }
      });
      usage = {
        requestId: log.requestId,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        durationMs: log.durationMs
      };
      const assistant = response.choices[0]?.message;
      if (!assistant) break;
      messages.push(assistant);
      finalMessage = assistant.content ?? finalMessage;
      const calls = assistant.tool_calls ?? [];
      if (!calls.length) break;
      for (const call of calls) {
        const started = Date.now();
        try {
          const output = await executeAgentTool(call.function.name as AgentToolName, call.function.arguments, context);
          toolCalls.push({ id: call.id, tool: call.function.name as AgentToolName, input: safeJson(call.function.arguments), output, status: "success", durationMs: Date.now() - started });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output).slice(0, 60_000) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toolCalls.push({ id: call.id, tool: call.function.name as AgentToolName, input: safeJson(call.function.arguments), output: null, status: "error", error: message, durationMs: Date.now() - started });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ success: false, error: message }).slice(0, 20_000) });
        }
      }
    }
    return { finalMessage, toolCalls, pendingChanges: context.pendingChanges, usage };
  }
}

function systemPrompt(): string {
  return `You are Aeta's DeepSeek-powered coding agent. Use only the provided tools. Do not claim you changed files unless a tool returned success. For code changes, call create_file/edit_file/delete_file so the backend can create a diff for user review. Never request or reveal secrets. Inspect relevant files before proposing edits. If context is insufficient, explicitly say what information is missing instead of guessing. Keep final responses concise and include tests or commands actually run.`;
}

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw || "{}"); } catch { return raw; }
}
