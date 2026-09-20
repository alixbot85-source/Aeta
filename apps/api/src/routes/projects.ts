import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { projectTemplates, scaffoldTemplate, WorkspaceFileSystem, type ProjectTemplate } from "@aeta/filesystem";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { prisma } from "../db/prisma.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/templates", (_req, res) => res.json(ok({ templates: projectTemplates })));

projectsRouter.get("/:workspaceId", requireWorkspace("workspace:read"), async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({ where: { workspaceId: req.workspace!.id }, orderBy: { createdAt: "desc" } });
    res.json(ok({ projects }));
  } catch (error) { next(error); }
});

projectsRouter.post("/:workspaceId", requireWorkspace("workspace:update"), validate(z.object({ name: z.string().min(1).max(120), template: z.enum(["nextjs", "react", "vue", "vite", "node", "python", "fastapi", "express", "html"]).default("react") })), async (req, res, next) => {
  try {
    const template = req.body.template as ProjectTemplate;
    await scaffoldTemplate(new WorkspaceFileSystem(req.workspace!.rootPath), template);
    const project = await prisma.project.create({ data: { workspaceId: req.workspace!.id, name: req.body.name, template, startCommand: startCommand(template) } });
    res.status(201).json(ok({ project }));
  } catch (error) { next(error); }
});

projectsRouter.patch("/:workspaceId/:projectId", requireWorkspace("workspace:update"), validate(z.object({ name: z.string().optional(), startCommand: z.string().optional(), env: z.record(z.string()).optional() })), async (req, res, next) => {
  try {
    const project = await prisma.project.update({ where: { id: req.params.projectId }, data: req.body });
    res.json(ok({ project }));
  } catch (error) { next(error); }
});

function startCommand(template: ProjectTemplate): string {
  return projectTemplates.find((item) => item.id === template)?.startCommand ?? "";
}
