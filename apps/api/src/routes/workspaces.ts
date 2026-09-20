import { Router } from "express";
import { z } from "zod";
import { ok, AppError } from "@aeta/shared";
import { projectTemplates, type ProjectTemplate } from "@aeta/filesystem";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { createWorkspace } from "../services/workspaces.js";
import { audit } from "../services/audit.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.get("/", async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      include: { workspace: { include: { projects: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.json(ok({ workspaces: memberships.map((m: { workspace: unknown; role: string }) => ({ ...(m.workspace as object), role: m.role })) }));
  } catch (error) { next(error); }
});

workspacesRouter.post("/", validate(z.object({ name: z.string().min(1).max(120), template: z.enum(["nextjs", "react", "vue", "vite", "node", "python", "fastapi", "express", "html"]).default("react") })), async (req, res, next) => {
  try {
    const body = req.body as { name: string; template: ProjectTemplate };
    const workspace = await createWorkspace(req.user!.id, body.name, body.template);
    await audit(req, "workspace.create", `workspace:${workspace.id}`, { template: body.template });
    res.status(201).json(ok({ workspace }));
  } catch (error) { next(error); }
});

workspacesRouter.get("/templates", (_req, res) => {
  res.json(ok({ templates: projectTemplates }));
});

workspacesRouter.get("/:workspaceId", requireWorkspace("workspace:read"), async (req, res) => {
  res.json(ok({ workspace: req.workspace, role: req.workspaceRole }));
});

workspacesRouter.patch("/:workspaceId", requireWorkspace("workspace:update"), validate(z.object({ name: z.string().min(1).max(120) })), async (req, res, next) => {
  try {
    const workspace = await prisma.workspace.update({ where: { id: req.workspace!.id }, data: { name: String(req.body.name) } });
    await audit(req, "workspace.update", `workspace:${workspace.id}`);
    res.json(ok({ workspace }));
  } catch (error) { next(error); }
});

workspacesRouter.delete("/:workspaceId", requireWorkspace("workspace:delete"), async (req, res, next) => {
  try {
    if (req.workspaceRole !== "OWNER") throw new AppError("PERMISSION_DENIED", "Only owners can delete a workspace.", 403);
    await prisma.workspace.delete({ where: { id: req.workspace!.id } });
    await audit(req, "workspace.delete", `workspace:${req.workspace!.id}`);
    res.json(ok({ deleted: true }));
  } catch (error) { next(error); }
});

workspacesRouter.get("/:workspaceId/members", requireWorkspace("member:manage"), async (req, res, next) => {
  try {
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: req.workspace!.id }, include: { user: { select: { id: true, email: true, name: true } } } });
    res.json(ok({ members }));
  } catch (error) { next(error); }
});
