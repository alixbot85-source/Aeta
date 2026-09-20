import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { GitService } from "@aeta/git";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";
import { audit } from "../services/audit.js";

export const gitRouter = Router();
const git = new GitService();

gitRouter.use(requireAuth);

gitRouter.post("/:workspaceId/init", requireWorkspace("git:write"), async (req, res, next) => {
  try {
    const output = await git.init(req.workspace!.rootPath);
    await audit(req, "git.init");
    res.json(ok({ output }));
  } catch (error) { next(error); }
});

gitRouter.get("/:workspaceId/status", requireWorkspace("git:read"), async (req, res, next) => {
  try { res.json(ok({ status: await git.status(req.workspace!.rootPath) })); }
  catch (error) { next(error); }
});

gitRouter.get("/:workspaceId/diff", requireWorkspace("git:read"), async (req, res, next) => {
  try { res.json(ok({ diff: await git.diff(req.workspace!.rootPath, req.query.staged === "true", req.query.path ? String(req.query.path) : undefined) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/stage", requireWorkspace("git:write"), validate(z.object({ files: z.array(z.string()).min(1) })), async (req, res, next) => {
  try { res.json(ok({ output: await git.add(req.workspace!.rootPath, req.body.files) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/unstage", requireWorkspace("git:write"), validate(z.object({ files: z.array(z.string()).min(1) })), async (req, res, next) => {
  try { res.json(ok({ output: await git.unstage(req.workspace!.rootPath, req.body.files) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/commit", requireWorkspace("git:write"), validate(z.object({ message: z.string().min(1).max(500) })), async (req, res, next) => {
  try {
    const output = await git.commit(req.workspace!.rootPath, req.body.message);
    await audit(req, "git.commit", undefined, { message: req.body.message });
    res.json(ok({ output }));
  } catch (error) { next(error); }
});

gitRouter.get("/:workspaceId/branches", requireWorkspace("git:read"), async (req, res, next) => {
  try { res.json(ok({ branches: await git.branches(req.workspace!.rootPath) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/checkout", requireWorkspace("git:write"), validate(z.object({ branch: z.string().min(1).max(200) })), async (req, res, next) => {
  try { res.json(ok({ output: await git.checkout(req.workspace!.rootPath, req.body.branch) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/pull", requireWorkspace("git:write"), async (req, res, next) => {
  try { res.json(ok({ output: await git.pull(req.workspace!.rootPath) })); }
  catch (error) { next(error); }
});

gitRouter.post("/:workspaceId/push", requireWorkspace("git:write"), async (req, res, next) => {
  try { res.json(ok({ output: await git.push(req.workspace!.rootPath) })); }
  catch (error) { next(error); }
});

gitRouter.get("/:workspaceId/log", requireWorkspace("git:read"), async (req, res, next) => {
  try { res.json(ok({ log: await git.log(req.workspace!.rootPath, Number(req.query.limit ?? 50)) })); }
  catch (error) { next(error); }
});
