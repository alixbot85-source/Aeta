import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { ContextEngine, DeepSeekClient } from "@aeta/ai";
import { aiRateLimit } from "../middleware/security.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

export const aiRouter = Router();
const client = new DeepSeekClient({ apiKey: env.DEEPSEEK_API_KEY, baseUrl: env.DEEPSEEK_BASE_URL, model: env.DEEPSEEK_MODEL });

const chatSchema = z.object({
  message: z.string().min(1).max(20000),
  conversationId: z.string().uuid().optional(),
  currentFile: z.string().optional(),
  selectedCode: z.string().optional(),
  openFiles: z.array(z.string()).default([]),
  errorMessages: z.array(z.string()).default([]),
  terminalOutput: z.string().optional(),
  gitDiff: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(16000).optional()
});

aiRouter.use(requireAuth, aiRateLimit);

aiRouter.post("/:workspaceId/chat", requireWorkspace("ai:chat"), validate(chatSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof chatSchema>;
    const context = await new ContextEngine(req.workspace!.rootPath).build({ userPrompt: body.message, currentFile: body.currentFile, selectedCode: body.selectedCode, openFiles: body.openFiles, errorMessages: body.errorMessages, terminalOutput: body.terminalOutput, gitDiff: body.gitDiff });
    const conversation = body.conversationId
      ? await prisma.conversation.findUnique({ where: { id: body.conversationId } })
      : await prisma.conversation.create({ data: { userId: req.user!.id, workspaceId: req.workspace!.id, title: body.message.slice(0, 80) } });
    if (!conversation) throw new Error("Conversation not found");
    await prisma.message.create({ data: { conversationId: conversation.id, userId: req.user!.id, role: "user", content: body.message } });
    const { response, log } = await client.chat({
      temperature: body.temperature,
      max_tokens: body.maxTokens,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: formatContext(body.message, context) }
      ],
      thinking: { type: "enabled" },
      reasoning_effort: "medium"
    });
    const answer = response.choices[0]?.message?.content ?? "";
    await prisma.message.create({ data: { conversationId: conversation.id, role: "assistant", content: answer, metadata: { model: log.model, usage: log } } });
    await saveUsage(req.user!.id, req.workspace!.id, log);
    res.json(ok({ conversationId: conversation.id, message: answer, usage: log, contextSummary: context.summary, truncated: context.truncated }));
  } catch (error) { next(error); }
});

aiRouter.post("/:workspaceId/chat/stream", requireWorkspace("ai:chat"), validate(chatSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof chatSchema>;
    const context = await new ContextEngine(req.workspace!.rootPath).build({ userPrompt: body.message, currentFile: body.currentFile, selectedCode: body.selectedCode, openFiles: body.openFiles, errorMessages: body.errorMessages, terminalOutput: body.terminalOutput, gitDiff: body.gitDiff });
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });
    res.write(`event: status\ndata: ${JSON.stringify({ status: "context_selected", summary: context.summary, truncated: context.truncated })}\n\n`);
    let content = "";
    let finalLog: unknown;
    const generator = client.streamChat({
      temperature: body.temperature,
      max_tokens: body.maxTokens,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: formatContext(body.message, context) }
      ],
      thinking: { type: "enabled" },
      reasoning_effort: "medium"
    });
    while (true) {
      const nextChunk = await generator.next();
      if (nextChunk.done) {
        finalLog = nextChunk.value;
        break;
      }
      const delta = nextChunk.value.chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        content += delta;
        res.write(`event: token\ndata: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    if (finalLog && typeof finalLog === "object") await saveUsage(req.user!.id, req.workspace!.id, finalLog as never);
    res.write(`event: done\ndata: ${JSON.stringify({ content, usage: finalLog })}\n\n`);
    res.end();
  } catch (error) { next(error); }
});

aiRouter.get("/settings/deepseek", async (_req, res) => {
  res.json(ok({ provider: "DeepSeek", configured: client.isConfigured(), model: env.DEEPSEEK_MODEL, baseUrl: env.DEEPSEEK_BASE_URL, streaming: true }));
});

function systemPrompt(): string {
  return "You are Aeta's DeepSeek-only coding assistant. Analyze only the supplied context. Do not invent files, credentials, or behavior. If context is insufficient, return INFORMATION_REQUIRED with the missing details. Never ask for or reveal API keys. Provide concrete, safe coding guidance.";
}

function formatContext(userMessage: string, context: Awaited<ReturnType<ContextEngine["build"]>>): string {
  const files = context.files.map((file) => `--- FILE: ${file.path} (${file.reason}) ---\n${file.content}`).join("\n\n");
  return `User request:\n${userMessage}\n\nProject tree:\n${context.tree}\n\nSelected code:\n${context.selectedCode ?? "(none)"}\n\nTerminal output:\n${context.terminalOutput ?? "(none)"}\n\nGit diff:\n${context.gitDiff ?? "(none)"}\n\nRelevant files:\n${files || "(none selected)"}`;
}

async function saveUsage(userId: string, workspaceId: string, log: { requestId: string; model: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; durationMs: number; status: string }) {
  await prisma.aIUsageLog.create({ data: { requestId: log.requestId, userId, workspaceId, model: log.model, inputTokens: log.inputTokens, outputTokens: log.outputTokens, totalTokens: log.totalTokens, durationMs: log.durationMs, status: log.status } }).catch(() => undefined);
}
