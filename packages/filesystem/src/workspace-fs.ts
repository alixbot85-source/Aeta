import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { AppError } from "@aeta/shared";
import { assertSafeToExpose, normalizeRelativePath, resolveWorkspacePath, shouldSkipEntry } from "./safe-path.js";

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
};

export type FileReadResult = {
  path: string;
  content: string;
  size: number;
  hash: string;
  mtime: string;
};

export type WriteResult = {
  path: string;
  bytes: number;
  hash: string;
};

export class WorkspaceFileSystem {
  constructor(public readonly root: string) {}

  async ensureRoot(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
  }

  resolve(relativePath = ""): string {
    return resolveWorkspacePath(this.root, relativePath);
  }

  async tree(relativePath = "", maxDepth = 6): Promise<FileNode[]> {
    await this.ensureRoot();
    const rootPath = this.resolve(relativePath);
    const baseRel = normalizeRelativePath(relativePath);
    const stat = await fs.stat(rootPath).catch(() => null);
    if (!stat) throw new AppError("FILE_NOT_FOUND", "Path does not exist.", 404);
    if (!stat.isDirectory()) throw new AppError("VALIDATION_ERROR", "Path is not a directory.", 400);
    return this.readDirectory(rootPath, baseRel, maxDepth);
  }

  private async readDirectory(absoluteDir: string, relativeDir: string, depth: number): Promise<FileNode[]> {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const nodes: FileNode[] = [];
    for (const entry of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
      if (shouldSkipEntry(entry.name)) continue;
      const rel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(absoluteDir, entry.name);
      const stat = await fs.stat(absolute).catch(() => null);
      if (!stat) continue;
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: rel,
          type: "directory",
          updatedAt: stat.mtime.toISOString(),
          children: depth > 0 ? await this.readDirectory(absolute, rel, depth - 1) : []
        });
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: rel, type: "file", size: stat.size, updatedAt: stat.mtime.toISOString() });
      }
    }
    return nodes;
  }

  async readFile(relativePath: string, maxBytes = 2 * 1024 * 1024): Promise<FileReadResult> {
    assertSafeToExpose(relativePath);
    const absolute = this.resolve(relativePath);
    const stat = await fs.stat(absolute).catch(() => null);
    if (!stat || !stat.isFile()) throw new AppError("FILE_NOT_FOUND", "File does not exist.", 404);
    if (stat.size > maxBytes) {
      throw new AppError("VALIDATION_ERROR", `File is too large to open (${stat.size} bytes).`, 413);
    }
    const content = await fs.readFile(absolute, "utf8");
    return { path: normalizeRelativePath(relativePath), content, size: stat.size, hash: sha256(content), mtime: stat.mtime.toISOString() };
  }

  async writeFile(relativePath: string, content: string): Promise<WriteResult> {
    const rel = normalizeRelativePath(relativePath);
    if (!rel) throw new AppError("VALIDATION_ERROR", "Cannot write the workspace root as a file.", 400);
    const absolute = this.resolve(rel);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
    return { path: rel, bytes: Buffer.byteLength(content), hash: sha256(content) };
  }

  async createFile(relativePath: string, content = ""): Promise<WriteResult> {
    const absolute = this.resolve(relativePath);
    const exists = await fs.stat(absolute).then(() => true).catch(() => false);
    if (exists) throw new AppError("VALIDATION_ERROR", "File already exists.", 409);
    return this.writeFile(relativePath, content);
  }

  async delete(relativePath: string): Promise<{ path: string }> {
    const rel = normalizeRelativePath(relativePath);
    if (!rel) throw new AppError("VALIDATION_ERROR", "Cannot delete the workspace root.", 400);
    const absolute = this.resolve(rel);
    await fs.rm(absolute, { recursive: true, force: false }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") throw new AppError("FILE_NOT_FOUND", "Path does not exist.", 404);
      throw error;
    });
    return { path: rel };
  }

  async mkdir(relativePath: string): Promise<{ path: string }> {
    const rel = normalizeRelativePath(relativePath);
    if (!rel) throw new AppError("VALIDATION_ERROR", "Directory path is required.", 400);
    await fs.mkdir(this.resolve(rel), { recursive: true });
    return { path: rel };
  }

  async rename(oldPath: string, newName: string): Promise<{ from: string; to: string }> {
    if (newName.includes("/") || newName.includes("\\") || !newName.trim()) {
      throw new AppError("VALIDATION_ERROR", "New name must be a single path segment.", 400);
    }
    const fromRel = normalizeRelativePath(oldPath);
    const toRel = normalizeRelativePath(path.posix.join(path.posix.dirname(fromRel), newName));
    await fs.rename(this.resolve(fromRel), this.resolve(toRel));
    return { from: fromRel, to: toRel };
  }

  async move(from: string, to: string): Promise<{ from: string; to: string }> {
    const fromRel = normalizeRelativePath(from);
    const toRel = normalizeRelativePath(to);
    await fs.mkdir(path.dirname(this.resolve(toRel)), { recursive: true });
    await fs.rename(this.resolve(fromRel), this.resolve(toRel));
    return { from: fromRel, to: toRel };
  }

  async copy(from: string, to: string): Promise<{ from: string; to: string }> {
    const fromRel = normalizeRelativePath(from);
    const toRel = normalizeRelativePath(to);
    await fs.mkdir(path.dirname(this.resolve(toRel)), { recursive: true });
    await fs.cp(this.resolve(fromRel), this.resolve(toRel), { recursive: true, errorOnExist: true, force: false });
    return { from: fromRel, to: toRel };
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.stat(this.resolve(relativePath)).then(() => true).catch(() => false);
  }

  createReadStream(relativePath: string) {
    return createReadStream(this.resolve(relativePath));
  }
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
