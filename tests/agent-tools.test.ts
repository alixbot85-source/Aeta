import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeAgentTool, applyPendingChange } from "@aeta/agent";
import { WorkspaceFileSystem } from "@aeta/filesystem";

describe("agent tools", () => {
  it("creates pending diffs before applying file edits", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-agent-"));
    const workspace = new WorkspaceFileSystem(root);
    await workspace.createFile("app.ts", "const user = null;\n");
    const context = { workspaceRoot: root, pendingChanges: [], runningServers: new Map<string, string>() };
    const result = await executeAgentTool("edit_file", { path: "app.ts", content: "const user = await getUser();\n" }, context);
    expect(JSON.stringify(result)).toContain("pendingChangeId");
    expect((await workspace.readFile("app.ts")).content).toContain("null");
    await applyPendingChange(context.pendingChanges[0], root);
    expect((await workspace.readFile("app.ts")).content).toContain("getUser");
  });
});
