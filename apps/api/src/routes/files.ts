import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { WorkspaceFileSystem, sha256 } from "@aeta/filesystem";
import { buildUnifiedDiff } from "@aeta/agent";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { audit } from "../services/audit.js";

export const filesRouter = Router();
filesRouter.use(requireAuth);

filesRouter.get("/:workspaceId/tree", requireWorkspace("file:read"), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const tree = await fs.tree(String(req.query.path ?? ""), Number(req.query.depth ?? 6));
    res.json(ok({ tree }));
  } catch (error) { next(error); }
});

filesRouter.get("/:workspaceId/read", requireWorkspace("file:read"), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const file = await fs.readFile(String(req.query.path ?? ""));
    res.json(ok({ file }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/write", requireWorkspace("file:write"), validate(z.object({ path: z.string().min(1), content: z.string().max(20 * 1024 * 1024) })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const path = String(req.body.path);
    const previous = await fs.readFile(path).then((r) => r.content).catch(() => "");
    const result = await fs.writeFile(path, String(req.body.content));
    await prisma.file.upsert({ where: { workspaceId_path: { workspaceId: req.workspace!.id, path } }, update: { hash: result.hash, size: result.bytes }, create: { workspaceId: req.workspace!.id, path, hash: result.hash, size: result.bytes } });
    await prisma.changeHistory.create({ data: { workspaceId: req.workspace!.id, userId: req.user!.id, path, oldContent: previous, newContent: String(req.body.content), diff: buildUnifiedDiff(path, previous, String(req.body.content)), action: previous ? "write" : "create" } });
    await audit(req, "file.write", path);
    res.json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/create", requireWorkspace("file:write"), validate(z.object({ path: z.string().min(1), content: z.string().default("") })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const result = await fs.createFile(String(req.body.path), String(req.body.content ?? ""));
    await prisma.file.create({ data: { workspaceId: req.workspace!.id, path: result.path, hash: result.hash, size: result.bytes } }).catch(() => undefined);
    await audit(req, "file.create", result.path);
    res.status(201).json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/mkdir", requireWorkspace("file:write"), validate(z.object({ path: z.string().min(1) })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const result = await fs.mkdir(String(req.body.path));
    await prisma.folder.upsert({ where: { workspaceId_path: { workspaceId: req.workspace!.id, path: result.path } }, update: {}, create: { workspaceId: req.workspace!.id, path: result.path } });
    await audit(req, "folder.create", result.path);
    res.status(201).json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.delete("/:workspaceId", requireWorkspace("file:delete"), validate(z.object({ path: z.string().min(1) }), "query"), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const path = String(req.query.path);
    const previous = await fs.readFile(path).then((r) => r.content).catch(() => null);
    const result = await fs.delete(path);
    await prisma.file.deleteMany({ where: { workspaceId: req.workspace!.id, path } });
    await prisma.folder.deleteMany({ where: { workspaceId: req.workspace!.id, path } });
    await prisma.changeHistory.create({ data: { workspaceId: req.workspace!.id, userId: req.user!.id, path, oldContent: previous, action: "delete" } });
    await audit(req, "file.delete", result.path);
    res.json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/rename", requireWorkspace("file:write"), validate(z.object({ path: z.string().min(1), newName: z.string().min(1) })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const result = await fs.rename(String(req.body.path), String(req.body.newName));
    await audit(req, "file.rename", result.from, { to: result.to });
    res.json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/move", requireWorkspace("file:write"), validate(z.object({ from: z.string().min(1), to: z.string().min(1) })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const result = await fs.move(String(req.body.from), String(req.body.to));
    await audit(req, "file.move", result.from, { to: result.to });
    res.json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.post("/:workspaceId/copy", requireWorkspace("file:write"), validate(z.object({ from: z.string().min(1), to: z.string().min(1) })), async (req, res, next) => {
  try {
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const result = await fs.copy(String(req.body.from), String(req.body.to));
    await audit(req, "file.copy", result.from, { to: result.to });
    res.json(ok({ result }));
  } catch (error) { next(error); }
});

filesRouter.get("/:workspaceId/history", requireWorkspace("file:read"), async (req, res, next) => {
  try {
    const history = await prisma.changeHistory.findMany({ where: { workspaceId: req.workspace!.id, ...(req.query.path ? { path: String(req.query.path) } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
    res.json(ok({ history }));
  } catch (error) { next(error); }
});
