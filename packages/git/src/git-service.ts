import { AppError } from "@aeta/shared";
import { CommandSandbox } from "@aeta/terminal";

export type GitFileStatus = {
  path: string;
  index: string;
  workingTree: string;
};

export class GitService {
  constructor(private readonly sandbox = new CommandSandbox()) {}

  async init(workspaceRoot: string): Promise<string> {
    const result = await this.git(workspaceRoot, "init");
    return result.stdout || result.stderr;
  }

  async status(workspaceRoot: string): Promise<{ branch: string; files: GitFileStatus[]; raw: string }> {
    const result = await this.git(workspaceRoot, "status --porcelain=v1 -b");
    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    const branchLine = lines.shift() ?? "## No branch";
    const branch = branchLine.replace(/^##\s*/, "");
    const files = lines.map((line) => ({ index: line[0] ?? " ", workingTree: line[1] ?? " ", path: line.slice(3) }));
    return { branch, files, raw: result.stdout };
  }

  async diff(workspaceRoot: string, staged = false, path?: string): Promise<string> {
    const safePath = path ? ` -- ${quote(path)}` : "";
    const result = await this.git(workspaceRoot, `diff ${staged ? "--cached" : ""}${safePath}`.trim());
    return result.stdout;
  }

  async add(workspaceRoot: string, files: string[]): Promise<string> {
    if (!files.length) throw new AppError("VALIDATION_ERROR", "At least one file must be staged.", 400);
    const result = await this.git(workspaceRoot, `add -- ${files.map(quote).join(" ")}`);
    return result.stdout || result.stderr;
  }

  async unstage(workspaceRoot: string, files: string[]): Promise<string> {
    if (!files.length) throw new AppError("VALIDATION_ERROR", "At least one file must be unstaged.", 400);
    const result = await this.git(workspaceRoot, `reset HEAD -- ${files.map(quote).join(" ")}`);
    return result.stdout || result.stderr;
  }

  async commit(workspaceRoot: string, message: string): Promise<string> {
    if (!message.trim()) throw new AppError("VALIDATION_ERROR", "Commit message is required.", 400);
    const result = await this.git(workspaceRoot, `commit -m ${quote(message)}`, 120_000);
    return result.stdout || result.stderr;
  }

  async branches(workspaceRoot: string): Promise<string[]> {
    const result = await this.git(workspaceRoot, "branch --list --format='%(refname:short)'");
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  async checkout(workspaceRoot: string, branch: string): Promise<string> {
    assertBranch(branch);
    const result = await this.git(workspaceRoot, `checkout ${quote(branch)}`);
    return result.stdout || result.stderr;
  }

  async pull(workspaceRoot: string): Promise<string> {
    const result = await this.git(workspaceRoot, "pull --ff-only", 120_000);
    return result.stdout || result.stderr;
  }

  async push(workspaceRoot: string): Promise<string> {
    const result = await this.git(workspaceRoot, "push", 120_000);
    return result.stdout || result.stderr;
  }

  async log(workspaceRoot: string, limit = 50): Promise<Array<{ hash: string; author: string; date: string; message: string }>> {
    const result = await this.git(workspaceRoot, `log -${Math.min(Math.max(limit, 1), 200)} --pretty=format:%H%x1f%an%x1f%aI%x1f%s`);
    return result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
      const [hash, author, date, message] = line.split("\x1f");
      return { hash, author, date, message };
    });
  }

  async clone(parentRoot: string, repoUrl: string, directory: string): Promise<string> {
    assertRepoUrl(repoUrl);
    if (!/^[A-Za-z0-9._-]+$/.test(directory)) throw new AppError("VALIDATION_ERROR", "Clone directory contains invalid characters.", 400);
    const result = await this.sandbox.runAndWait(`git clone ${quote(repoUrl)} ${quote(directory)}`, { workspaceRoot: parentRoot, timeoutMs: 300_000, cpuSeconds: 180, memoryMb: 1024 });
    if (result.exitCode !== 0) throw new AppError("INTERNAL_ERROR", result.stderr || "git clone failed", 500, undefined, false);
    return result.stdout || result.stderr;
  }

  private async git(workspaceRoot: string, args: string, timeoutMs = 60_000) {
    const result = await this.sandbox.runAndWait(`git ${args}`, { workspaceRoot, timeoutMs, cpuSeconds: 30, memoryMb: 512 });
    if (result.exitCode !== 0) throw new AppError("INTERNAL_ERROR", result.stderr || `git ${args} failed`, 500, undefined, false);
    return result;
  }
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function assertBranch(branch: string): void {
  if (!/^[A-Za-z0-9._\/-]+$/.test(branch) || branch.includes("..")) {
    throw new AppError("VALIDATION_ERROR", "Invalid branch name.", 400);
  }
}

function assertRepoUrl(repoUrl: string): void {
  if (!/^(https:\/\/|git@)[^\s]+$/.test(repoUrl)) {
    throw new AppError("VALIDATION_ERROR", "Only HTTPS and SSH Git URLs are allowed.", 400);
  }
}
