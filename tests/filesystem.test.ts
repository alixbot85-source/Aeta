import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceFileSystem, resolveWorkspacePath, searchWorkspace } from "@aeta/filesystem";

describe("workspace filesystem", () => {
  it("blocks path traversal", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-fs-"));
    expect(() => resolveWorkspacePath(root, "../etc/passwd")).toThrow(/traversal|escapes/i);
  });

  it("creates, reads, moves and deletes real files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-fs-"));
    const workspace = new WorkspaceFileSystem(root);
    await workspace.createFile("src/index.ts", "export const answer = 42;\n");
    expect((await workspace.readFile("src/index.ts")).content).toContain("answer");
    await workspace.move("src/index.ts", "src/main.ts");
    expect(await workspace.exists("src/main.ts")).toBe(true);
    await workspace.delete("src/main.ts");
    expect(await workspace.exists("src/main.ts")).toBe(false);
  });

  it("searches workspace contents", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-search-"));
    const workspace = new WorkspaceFileSystem(root);
    await workspace.createFile("README.md", "Aeta DeepSeek only\n");
    const matches = await searchWorkspace(root, { query: "DeepSeek" });
    expect(matches[0]?.file).toBe("README.md");
  });
});
