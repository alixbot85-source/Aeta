import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { CommandSandbox } from "@aeta/terminal";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { audit } from "../services/audit.js";

export const terminalRouter = Router();
export const terminalSandbox = new CommandSandbox();

terminalRouter.use(requireAuth);

terminalRouter.post("/:workspaceId/run", requireWorkspace("terminal:run"), validate(z.object({ command: z.string().min(1).max(4000), cwd: z.string().default(""), timeoutMs: z.number().int().min(1000).max(300000).default(60000) })), async (req, res, next) => {
  try {
    const session = await prisma.terminalSession.create({ data: { userId: req.user!.id, workspaceId: req.workspace!.id, command: req.body.command, cwd: req.body.cwd, status: "RUNNING" } });
    const result = await terminalSandbox.runAndWait(req.body.command, { workspaceRoot: req.workspace!.rootPath, cwd: req.body.cwd, timeoutMs: req.body.timeoutMs });
    await prisma.terminalSession.update({ where: { id: session.id }, data: { status: mapStatus(result.status), outputTail: tail(result.stdout + result.stderr), exitCode: result.exitCode ?? undefined, endedAt: new Date() } });
    await audit(req, "terminal.run", undefined, { command: req.body.command, exitCode: result.exitCode });
    res.json(ok({ sessionId: session.id, result }));
  } catch (error) { next(error); }
});

terminalRouter.get("/:workspaceId/sessions", requireWorkspace("terminal:run"), async (req, res, next) => {
  try {
    const sessions = await prisma.terminalSession.findMany({ where: { workspaceId: req.workspace!.id }, orderBy: { startedAt: "desc" }, take: 50 });
    res.json(ok({ sessions }));
  } catch (error) { next(error); }
});

terminalRouter.post("/:workspaceId/stop", requireWorkspace("terminal:kill"), validate(z.object({ processId: z.string().uuid() })), async (req, res, next) => {
  try {
    const stopped = terminalSandbox.stop(req.body.processId, "SIGINT");
    res.json(ok({ stopped }));
  } catch (error) { next(error); }
});

function mapStatus(status: string) {
  if (status === "timeout") return "TIMEOUT" as const;
  if (status === "killed") return "KILLED" as const;
  if (status === "error") return "ERROR" as const;
  return "EXITED" as const;
}

export function tail(value: string, limit = 16000): string {
  return value.length <= limit ? value : value.slice(value.length - limit);
}
