import { randomUUID } from "node:crypto";
import { AppError } from "@aeta/shared";
import { WorkspaceFileSystem, searchWorkspace } from "@aeta/filesystem";
import { CommandSandbox } from "@aeta/terminal";
import { GitService } from "@aeta/git";
import type { DeepSeekTool } from "@aeta/ai";
import { buildUnifiedDiff, type PendingChange } from "./diff-engine.js";

export type AgentToolName =
  | "list_files"
  | "read_file"
  | "search_files"
  | "create_file"
  | "edit_file"
  | "delete_file"
  | "create_directory"
  | "rename_file"
  | "move_file"
  | "run_command"
  | "install_package"
  | "get_terminal_output"
  | "git_status"
  | "git_diff"
  | "git_commit"
  | "start_server"
  | "stop_server";

export type AgentToolCallLog = {
  id: string;
  tool: AgentToolName;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  durationMs: number;
  error?: string;
};

export type AgentToolContext = {
  workspaceRoot: string;
  workspaceId?: string;
  allowCommands?: boolean;
  allowGitWrite?: boolean;
  allowFileMutations?: boolean;
  pendingChanges: PendingChange[];
  terminalTail?: string;
  runningServers: Map<string, string>;
};

export const agentTools: DeepSeekTool[] = [
  tool("list_files", "List files and folders in the workspace. Input: {path?: string, depth?: number}.", { type: "object", properties: { path: { type: "string" }, depth: { type: "integer", minimum: 0, maximum: 8 } } }),
  tool("read_file", "Read a UTF-8 text file from the workspace. Never use for secrets such as .env.", { type: "object", properties: { path: { type: "string" } }, required: ["path"] }),
  tool("search_files", "Search file contents with literal or regex search.", { type: "object", properties: { query: { type: "string" }, regex: { type: "boolean" }, caseSensitive: { type: "boolean" } }, required: ["query"] }),
  tool("create_file", "Propose creating a file. This returns a pending diff; it does not write until user accepts.", { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }),
  tool("edit_file", "Propose replacing an entire file's content. Returns a pending diff; it does not write until user accepts.", { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }),
  tool("delete_file", "Propose deleting a file or directory. Returns a pending diff/operation; it does not delete until user accepts.", { type: "object", properties: { path: { type: "string" } }, required: ["path"] }),
  tool("create_directory", "Create a directory in the workspace immediately; use only when necessary.", { type: "object", properties: { path: { type: "string" } }, required: ["path"] }),
  tool("rename_file", "Rename a file or folder immediately when file mutations are allowed.", { type: "object", properties: { path: { type: "string" }, newName: { type: "string" } }, required: ["path", "newName"] }),
  tool("move_file", "Move a file or folder immediately when file mutations are allowed.", { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] }),
  tool("run_command", "Run a command in the workspace sandbox. Requires explicit command permission.", { type: "object", properties: { command: { type: "string" }, timeoutMs: { type: "integer", minimum: 1000, maximum: 300000 } }, required: ["command"] }),
  tool("install_package", "Install a package using npm, pnpm, yarn, pip, cargo, or go. Requires command permission.", { type: "object", properties: { manager: { type: "string", enum: ["npm", "pnpm", "yarn", "pip", "cargo", "go"] }, packageName: { type: "string" }, dev: { type: "boolean" } }, required: ["manager", "packageName"] }),
  tool("get_terminal_output", "Get the latest terminal output captured for context.", { type: "object", properties: {} }),
  tool("git_status", "Get git status.", { type: "object", properties: {} }),
  tool("git_diff", "Get git diff.", { type: "object", properties: { staged: { type: "boolean" } } }),
  tool("git_commit", "Create a git commit. Requires git write permission.", { type: "object", properties: { message: { type: "string" } }, required: ["message"] }),
  tool("start_server", "Start a long running server command. Requires command permission.", { type: "object", properties: { command: { type: "string" } }, required: ["command"] }),
  tool("stop_server", "Stop a server by session id.", { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"] })
];

const sandbox = new CommandSandbox();
const git = new GitService(sandbox);

export async function executeAgentTool(name: AgentToolName, rawArgs: string | Record<string, unknown>, context: AgentToolContext): Promise<unknown> {
  const args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : rawArgs;
  const fs = new WorkspaceFileSystem(context.workspaceRoot);
  switch (name) {
    case "list_files":
      return fs.tree(String(args.path ?? ""), Number(args.depth ?? 4));
    case "read_file":
      return fs.readFile(String(args.path));
    case "search_files":
      return searchWorkspace(context.workspaceRoot, { query: String(args.query), regex: Boolean(args.regex), caseSensitive: Boolean(args.caseSensitive), limit: 200 });
    case "create_file": {
      const path = String(args.path);
      const newContent = String(args.content ?? "");
      const change = makeChange(context, path, "", newContent, "create");
      return { pendingChangeId: change.id, diff: change.diff, requiresUserReview: true };
    }
    case "edit_file": {
      const path = String(args.path);
      const oldContent = (await fs.readFile(path)).content;
      const newContent = String(args.content ?? "");
      const change = makeChange(context, path, oldContent, newContent, "edit");
      return { pendingChangeId: change.id, diff: change.diff, requiresUserReview: true };
    }
    case "delete_file": {
      const path = String(args.path);
      const oldContent = await fs.readFile(path).then((r) => r.content).catch(() => "");
      const change = makeChange(context, path, oldContent, "", "delete");
      return { pendingChangeId: change.id, diff: change.diff, requiresUserReview: true };
    }
    case "create_directory":
      requireFileMutation(context);
      return fs.mkdir(String(args.path));
    case "rename_file":
      requireFileMutation(context);
      return fs.rename(String(args.path), String(args.newName));
    case "move_file":
      requireFileMutation(context);
      return fs.move(String(args.from), String(args.to));
    case "run_command":
      requireCommands(context);
      return sandbox.runAndWait(String(args.command), { workspaceRoot: context.workspaceRoot, timeoutMs: Number(args.timeoutMs ?? 60_000) });
    case "install_package":
      requireCommands(context);
      return sandbox.runAndWait(buildInstallCommand(String(args.manager), String(args.packageName), Boolean(args.dev)), { workspaceRoot: context.workspaceRoot, timeoutMs: 300_000, cpuSeconds: 180, memoryMb: 1024 });
    case "get_terminal_output":
      return { output: context.terminalTail ?? "" };
    case "git_status":
      return git.status(context.workspaceRoot);
    case "git_diff":
      return git.diff(context.workspaceRoot, Boolean(args.staged));
    case "git_commit":
      if (!context.allowGitWrite) throw new AppError("PERMISSION_DENIED", "Git write permission was not granted for this agent run.", 403);
      return git.commit(context.workspaceRoot, String(args.message));
    case "start_server": {
      requireCommands(context);
      const session = sandbox.run(String(args.command), { workspaceRoot: context.workspaceRoot, timeoutMs: 24 * 60 * 60 * 1000, cpuSeconds: 24 * 60 * 60, memoryMb: 1024 });
      context.runningServers.set(session.id, String(args.command));
      return { sessionId: session.id, status: session.status };
    }
    case "stop_server":
      return { stopped: sandbox.stop(String(args.sessionId), "SIGTERM") };
    default:
      throw new AppError("VALIDATION_ERROR", `Unknown tool: ${name}`, 400);
  }
}

export async function applyPendingChange(change: PendingChange, workspaceRoot: string): Promise<void> {
  const fs = new WorkspaceFileSystem(workspaceRoot);
  if (change.status !== "pending") throw new AppError("VALIDATION_ERROR", "Pending change is not open.", 409);
  if (change.kind === "delete") await fs.delete(change.path);
  else await fs.writeFile(change.path, change.newContent);
  change.status = "accepted";
}

function tool(name: AgentToolName, description: string, parameters: Record<string, unknown>): DeepSeekTool {
  return { type: "function", function: { name, description, parameters } };
}

function makeChange(context: AgentToolContext, path: string, oldContent: string, newContent: string, kind: PendingChange["kind"]): PendingChange {
  const change: PendingChange = {
    id: randomUUID(),
    workspaceId: context.workspaceId,
    path,
    kind,
    oldContent,
    newContent,
    diff: buildUnifiedDiff(path, oldContent, newContent),
    status: "pending",
    createdAt: new Date().toISOString()
  };
  context.pendingChanges.push(change);
  return change;
}

function requireCommands(context: AgentToolContext): void {
  if (!context.allowCommands) throw new AppError("PERMISSION_DENIED", "Command execution was not granted for this agent run.", 403);
}

function requireFileMutation(context: AgentToolContext): void {
  if (!context.allowFileMutations) throw new AppError("PERMISSION_DENIED", "Immediate file mutation was not granted. Use create_file/edit_file/delete_file to propose diffs.", 403);
}

function buildInstallCommand(manager: string, packageName: string, dev: boolean): string {
  if (!/^[A-Za-z0-9@/_.,:+-]+$/.test(packageName)) throw new AppError("VALIDATION_ERROR", "Package name contains invalid characters.", 400);
  switch (manager) {
    case "npm": return `npm install ${dev ? "--save-dev " : ""}${packageName}`;
    case "pnpm": return `pnpm add ${dev ? "-D " : ""}${packageName}`;
    case "yarn": return `yarn add ${dev ? "-D " : ""}${packageName}`;
    case "pip": return `python -m pip install ${packageName}`;
    case "cargo": return `cargo add ${packageName}`;
    case "go": return `go get ${packageName}`;
    default: throw new AppError("VALIDATION_ERROR", "Unsupported package manager.", 400);
  }
}
