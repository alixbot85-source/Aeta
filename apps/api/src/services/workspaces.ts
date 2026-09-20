import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { WorkspaceFileSystem, scaffoldTemplate, type ProjectTemplate } from "@aeta/filesystem";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

export function workspacePathFor(userId: string, workspaceId = randomUUID()): string {
  return path.join(env.WORKSPACES_ROOT, userId, workspaceId);
}

export async function ensureWorkspaceRoot(rootPath: string): Promise<void> {
  await fs.mkdir(rootPath, { recursive: true });
}

export function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "workspace";
}

export async function createWorkspace(userId: string, name: string, template: ProjectTemplate = "react") {
  const id = randomUUID();
  const rootPath = workspacePathFor(userId, id);
  await ensureWorkspaceRoot(rootPath);
  await scaffoldTemplate(new WorkspaceFileSystem(rootPath), template);
  const workspace = await prisma.workspace.create({
    data: {
      id,
      name,
      slug: slugify(name),
      rootPath,
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
      projects: { create: { name, template, rootPath: "", startCommand: defaultStartCommand(template) } }
    },
    include: { projects: true, members: true }
  });
  return workspace;
}

function defaultStartCommand(template: ProjectTemplate): string {
  switch (template) {
    case "html": return "python -m http.server 8080 --bind 0.0.0.0";
    case "python": return "python main.py";
    case "fastapi": return "uvicorn main:app --host 0.0.0.0 --port 8000";
    case "node": return "npm start";
    case "express": return "npm run dev";
    default: return "npm run dev -- --host 0.0.0.0";
  }
}
