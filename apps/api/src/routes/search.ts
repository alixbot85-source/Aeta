import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { searchWorkspace, WorkspaceFileSystem } from "@aeta/filesystem";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireWorkspace, validate } from "../middleware/request.js";

export const searchRouter = Router();
searchRouter.use(requireAuth);

const searchBody = z.object({
  query: z.string().min(1).max(500),
  regex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(false),
  include: z.string().optional(),
  exclude: z.string().optional(),
  limit: z.number().int().min(1).max(2000).default(500)
});

searchRouter.post("/:workspaceId", requireWorkspace("file:read"), validate(searchBody), async (req, res, next) => {
  try {
    const matches = await searchWorkspace(req.workspace!.rootPath, req.body);
    res.json(ok({ matches }));
  } catch (error) { next(error); }
});

searchRouter.post("/:workspaceId/replace", requireWorkspace("file:write"), validate(searchBody.extend({ replacement: z.string().max(10000), dryRun: z.boolean().default(true) })), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof searchBody> & { replacement: string; dryRun: boolean };
    const matches = await searchWorkspace(req.workspace!.rootPath, body);
    if (body.dryRun) return res.json(ok({ matches, replaced: false }));
    const fs = new WorkspaceFileSystem(req.workspace!.rootPath);
    const files = Array.from(new Set(matches.map((m) => m.file)));
    const changed: Array<{ file: string; replacements: number }> = [];
    for (const file of files) {
      const read = await fs.readFile(file);
      const before = read.content;
      const pattern = body.regex ? new RegExp(body.query, body.caseSensitive ? "g" : "gi") : literalRegExp(body.query, body.caseSensitive, body.wholeWord);
      const after = before.replace(pattern, body.replacement);
      if (after !== before) {
        await fs.writeFile(file, after);
        changed.push({ file, replacements: (before.match(pattern) ?? []).length });
        await prisma.changeHistory.create({ data: { workspaceId: req.workspace!.id, userId: req.user!.id, path: file, oldContent: before, newContent: after, action: "replace" } });
      }
    }
    res.json(ok({ matches, changed, replaced: true }));
  } catch (error) { next(error); }
});

function literalRegExp(query: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, caseSensitive ? "g" : "gi");
}
