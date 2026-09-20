import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { AppError, redactSecrets } from "@aeta/shared";
import { resolveWorkspacePath } from "@aeta/filesystem";

export type CommandStatus = "starting" | "running" | "exited" | "killed" | "timeout" | "error";

export type CommandOptions = {
  workspaceRoot: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  maxOutputBytes?: number;
  allowNetwork?: boolean;
  cpuSeconds?: number;
  memoryMb?: number;
};

export type CommandResult = {
  id: string;
  command: string;
  cwd: string;
  status: CommandStatus;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type CommandEvent =
  | { type: "start"; id: string; cwd: string; command: string }
  | { type: "stdout"; id: string; data: string }
  | { type: "stderr"; id: string; data: string }
  | { type: "exit"; id: string; code: number | null; signal: NodeJS.Signals | null; status: CommandStatus };

export class RunningCommand extends EventEmitter {
  readonly id = randomUUID();
  status: CommandStatus = "starting";
  stdout = "";
  stderr = "";
  exitCode: number | null = null;
  signal: NodeJS.Signals | null = null;
  readonly startedAt = Date.now();
  private child?: ReturnType<typeof spawn>;
  private timer?: NodeJS.Timeout;
  private outputBytes = 0;

  constructor(public readonly command: string, private readonly options: Required<Pick<CommandOptions, "timeoutMs" | "maxOutputBytes" | "cpuSeconds" | "memoryMb">> & CommandOptions) {
    super();
  }

  start(): this {
    validateCommand(this.command);
    const cwd = resolveWorkspacePath(this.options.workspaceRoot, this.options.cwd ?? "");
    const limited = `ulimit -t ${Math.max(1, this.options.cpuSeconds)}; ulimit -v ${Math.max(65536, this.options.memoryMb * 1024)}; ${this.command}`;
    const env = sanitizeEnv({ ...process.env, ...this.options.env });
    if (this.options.allowNetwork === false) env.AETA_NETWORK_DISABLED = "1";
    this.child = spawn("bash", ["-lc", limited], {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    const child = this.child;
    if (!child.stdout || !child.stderr || !child.stdin) throw new AppError("COMMAND_REJECTED", "Unable to open command stdio streams.", 500);
    this.status = "running";
    this.emit("event", { type: "start", id: this.id, cwd, command: this.command } satisfies CommandEvent);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data: string) => this.collect("stdout", data));
    child.stderr.on("data", (data: string) => this.collect("stderr", data));
    child.on("error", (error) => {
      this.status = "error";
      this.stderr += String(redactSecrets(error.message));
      this.emit("event", { type: "stderr", id: this.id, data: this.stderr } satisfies CommandEvent);
    });
    child.on("close", (code, signal) => {
      if (this.status !== "timeout" && this.status !== "killed") this.status = "exited";
      this.exitCode = code;
      this.signal = signal;
      if (this.timer) clearTimeout(this.timer);
      this.emit("event", { type: "exit", id: this.id, code, signal, status: this.status } satisfies CommandEvent);
    });
    this.timer = setTimeout(() => {
      this.status = "timeout";
      this.kill("SIGTERM");
    }, this.options.timeoutMs);
    return this;
  }

  write(input: string): void {
    if (!this.child || this.child.killed) return;
    this.child.stdin?.write(input);
  }

  kill(signal: NodeJS.Signals = "SIGINT"): void {
    if (!this.child || this.child.killed) return;
    this.status = signal === "SIGTERM" ? this.status : "killed";
    try {
      if (process.platform !== "win32" && this.child.pid) process.kill(-this.child.pid, signal);
      else this.child.kill(signal);
    } catch {
      this.child.kill("SIGKILL");
    }
  }

  result(): CommandResult {
    return {
      id: this.id,
      command: this.command,
      cwd: this.options.cwd ?? "",
      status: this.status,
      exitCode: this.exitCode,
      signal: this.signal,
      stdout: this.stdout,
      stderr: this.stderr,
      durationMs: Date.now() - this.startedAt
    };
  }

  private collect(kind: "stdout" | "stderr", data: string): void {
    const redacted = String(redactSecrets(data));
    const remaining = this.options.maxOutputBytes - this.outputBytes;
    const clipped = remaining > 0 ? redacted.slice(0, remaining) : "";
    this.outputBytes += Buffer.byteLength(redacted);
    if (kind === "stdout") this.stdout += clipped;
    else this.stderr += clipped;
    if (clipped) this.emit("event", { type: kind, id: this.id, data: clipped } satisfies CommandEvent);
    if (this.outputBytes > this.options.maxOutputBytes) this.kill("SIGTERM");
  }
}

export class CommandSandbox {
  readonly running = new Map<string, RunningCommand>();

  run(command: string, options: CommandOptions): RunningCommand {
    const session = new RunningCommand(command, {
      timeoutMs: options.timeoutMs ?? 60_000,
      maxOutputBytes: options.maxOutputBytes ?? 2_000_000,
      cpuSeconds: options.cpuSeconds ?? 30,
      memoryMb: options.memoryMb ?? 512,
      ...options
    }).start();
    this.running.set(session.id, session);
    session.on("event", (event: CommandEvent) => {
      if (event.type === "exit") this.running.delete(session.id);
    });
    return session;
  }

  async runAndWait(command: string, options: CommandOptions): Promise<CommandResult> {
    const session = this.run(command, options);
    return new Promise((resolve) => {
      session.on("event", (event: CommandEvent) => {
        if (event.type === "exit") resolve(session.result());
      });
    });
  }

  stop(id: string, signal: NodeJS.Signals = "SIGINT"): boolean {
    const session = this.running.get(id);
    if (!session) return false;
    session.kill(signal);
    return true;
  }
}

export function validateCommand(command: string): void {
  if (!command.trim()) throw new AppError("VALIDATION_ERROR", "Command is required.", 400);
  if (command.includes("\0")) throw new AppError("COMMAND_REJECTED", "Command contains a null byte.", 400);
  if (command.length > 4000) throw new AppError("COMMAND_REJECTED", "Command is too long.", 400);
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^(PATH|HOME|SHELL|LANG|LC_|TERM|TMPDIR|USER|NODE_|npm_|PYTHON|PIP_|VIRTUAL_ENV|PORT|HOST|AETA_)/.test(key)) sanitized[key] = value;
    if (/^NEXT_PUBLIC_/.test(key)) sanitized[key] = value;
  }
  sanitized.PATH = env.PATH;
  sanitized.HOME = env.HOME;
  sanitized.SHELL = "/bin/bash";
  sanitized.TERM = "xterm-256color";
  return sanitized;
}
