import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitService } from "@aeta/git";

describe("git operations", () => {
  it("initializes and reports status", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-git-"));
    await fs.writeFile(path.join(root, "README.md"), "# test\n");
    const git = new GitService();
    await git.init(root);
    const status = await git.status(root);
    expect(status.raw).toContain("README.md");
  });
});
