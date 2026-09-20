import { Router } from "express";
import { z } from "zod";
import { ok, AppError } from "@aeta/shared";
import { ContextEngine } from "@aeta/ai";
import { DeepSeekAgentRunner, applyPendingChange } from "@aeta/agent";
import { aiRateLimit } from "../middleware/security.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { prisma } from "../db/prisma.js";
import { audit } from "../services/audit.js";

export const agentRouter = Router();
const runner = new DeepSeekAgentRunner();

const runSchema = z.object({
  request: z.string().min(1).max(20000),
  currentFile: z.string().optional(),
  selectedCode: z.string().optional(),
  openFiles: z.array(z.string()).default([]),
  terminalOutput: z.string().optional(),
  gitDiff: z.string().optional(),
  allowCommands: z.boolean().default(false),
  allowGitWrite: z.boolean().default(false),
  allowFileMutations: z.boolean().default(false)
});

agentRouter.use(requireAuth, aiRateLimit);

agentRouter.post("/:workspaceId/run", requireWorkspace("agent:run"), validate(runSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof runSchema>;
    const task = await prisma.agentTask.create({ data: { userId: req.user!.id, workspaceId: req.workspace!.id, request: body.request, status: "RUNNING" } });
    const context = await new ContextEngine(req.workspace!.rootPath).build({ userPrompt: body.request, currentFile: body.currentFile, selectedCode: body.selectedCode, openFiles: body.openFiles, terminalOutput: body.terminalOutput, gitDiff: body.gitDiff });
    const result = await runner.run({
      request: body.request,
      workspaceRoot: req.workspace!.rootPath,
      workspaceId: req.workspace!.id,
      contextPrompt: renderContext(context),
      allowCommands: body.allowCommands,
      allowGitWrite: body.allowGitWrite,
      allowFileMutations: body.allowFileMutations,
      terminalTail: body.terminalOutput
    });
    await prisma.$transaction([
      prisma.agentTask.update({ where: { id: task.id }, data: { status: result.pendingChanges.length ? "WAITING_FOR_REVIEW" : "COMPLETED", result: result.finalMessage, completedAt: result.pendingChanges.length ? undefined : new Date() } }),
      ...result.toolCalls.map((call) => prisma.agentToolCall.create({ data: { taskId: task.id, name: call.tool, input: call.input as object, output: call.output as object, status: call.status === "success" ? "SUCCESS" : "ERROR", durationMs: call.durationMs, error: call.error } })),
      ...result.pendingChanges.map((change) => prisma.pendingChange.create({ data: { id: change.id, taskId: task.id, workspaceId: req.workspace!.id, path: change.path, kind: change.kind, oldContent: change.oldContent, newContent: change.newContent, diff: change.diff } }))
    ]);
    await audit(req, "agent.run", `agentTask:${task.id}`, { pendingChanges: result.pendingChanges.length });
    res.status(201).json(ok({ taskId: task.id, ...result, contextSummary: context.summary }));
  } catch (error) {
    next(error);
  }
});

agentRouter.get("/:workspaceId/tasks", requireWorkspace("agent:run"), async (req, res, next) => {
  try {
    const tasks = await prisma.agentTask.findMany({ where: { workspaceId: req.workspace!.id }, include: { pendingChanges: true, toolCalls: true }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json(ok({ tasks }));
  } catch (error) { next(error); }
});

agentRouter.post("/:workspaceId/changes/:changeId/accept", requireWorkspace("file:write"), async (req, res, next) => {
  try {
    const change = await prisma.pendingChange.findUnique({ where: { id: req.params.changeId } });
    if (!change || change.workspaceId !== req.workspace!.id) throw new AppError("FILE_NOT_FOUND", "Pending change not found.", 404);
    if (change.status !== "PENDING") throw new AppError("VALIDATION_ERROR", "Change is not pending.", 409);
    const inMemoryChange = { ...change, status: "pending" as const, kind: change.kind as "create" | "edit" | "delete", createdAt: change.createdAt.toISOString() };
    await applyPendingChange(inMemoryChange, req.workspace!.rootPath);
    await prisma.$transaction([
      prisma.pendingChange.update({ where: { id: change.id }, data: { status: "ACCEPTED" } }),
      prisma.changeHistory.create({ data: { workspaceId: req.workspace!.id, userId: req.user!.id, path: change.path, oldContent: change.oldContent, newContent: change.newContent, diff: change.diff, action: `agent.${change.kind}` } })
    ]);
    await audit(req, "agent.change.accept", change.path);
    res.json(ok({ accepted: true }));
  } catch (error) { next(error); }
});

agentRouter.post("/:workspaceId/changes/:changeId/reject", requireWorkspace("file:write"), async (req, res, next) => {
  try {
    const change = await prisma.pendingChange.findUnique({ where: { id: req.params.changeId } });
    if (!change || change.workspaceId !== req.workspace!.id) throw new AppError("FILE_NOT_FOUND", "Pending change not found.", 404);
    await prisma.pendingChange.update({ where: { id: change.id }, data: { status: "REJECTED" } });
    await audit(req, "agent.change.reject", change.path);
    res.json(ok({ rejected: true }));
  } catch (error) { next(error); }
});

agentRouter.post("/:workspaceId/tasks/:taskId/accept-all", requireWorkspace("file:write"), async (req, res, next) => {
  try {
    const changes = await prisma.pendingChange.findMany({ where: { taskId: req.params.taskId, workspaceId: req.workspace!.id, status: "PENDING" } });
    for (const change of changes) {
      await applyPendingChange({ ...change, status: "pending" as const, kind: change.kind as "create" | "edit" | "delete", createdAt: change.createdAt.toISOString() }, req.workspace!.rootPath);
      await prisma.pendingChange.update({ where: { id: change.id }, data: { status: "ACCEPTED" } });
    }
    await prisma.agentTask.update({ where: { id: req.params.taskId }, data: { status: "COMPLETED", completedAt: new Date() } }).catch(() => undefined);
    res.json(ok({ accepted: changes.length }));
  } catch (error) { next(error); }
});

agentRouter.post("/:workspaceId/tasks/:taskId/reject-all", requireWorkspace("file:write"), async (req, res, next) => {
  try {
    const { count } = await prisma.pendingChange.updateMany({ where: { taskId: req.params.taskId, workspaceId: req.workspace!.id, status: "PENDING" }, data: { status: "REJECTED" } });
    await prisma.agentTask.update({ where: { id: req.params.taskId }, data: { status: "COMPLETED", completedAt: new Date() } }).catch(() => undefined);
    res.json(ok({ rejected: count }));
  } catch (error) { next(error); }
});

function renderContext(context: Awaited<ReturnType<ContextEngine["build"]>>): string {
  return [`Tree:\n${context.tree}`, context.selectedCode ? `Selected code:\n${context.selectedCode}` : "", context.gitDiff ? `Git diff:\n${context.gitDiff}` : "", ...context.files.map((file) => `File ${file.path}:\n${file.content}`)].filter(Boolean).join("\n\n");
}
