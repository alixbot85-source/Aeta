import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CommandSandbox } from "@aeta/terminal";

describe("command sandbox", () => {
  it("runs a command inside the workspace and streams output", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-terminal-"));
    const sandbox = new CommandSandbox();
    const result = await sandbox.runAndWait("printf hello", { workspaceRoot: root, timeoutMs: 5000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
  });

  it("times out long commands", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "aeta-terminal-"));
    const sandbox = new CommandSandbox();
    const result = await sandbox.runAndWait("sleep 2", { workspaceRoot: root, timeoutMs: 100, cpuSeconds: 1 });
    expect(["timeout", "killed", "exited"]).toContain(result.status);
  });
});
