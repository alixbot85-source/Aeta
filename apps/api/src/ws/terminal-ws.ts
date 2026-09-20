import type http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { CommandSandbox, type CommandEvent } from "@aeta/terminal";
import { hasPermission, type WorkspaceRole } from "@aeta/shared";
import { prisma } from "../db/prisma.js";
import { verifyJwt } from "../services/auth.js";
import { tail } from "../routes/terminal.js";

const sandbox = new CommandSandbox();

type ClientMessage =
  | { type: "run"; command: string; cwd?: string; timeoutMs?: number }
  | { type: "input"; data: string }
  | { type: "signal"; signal?: NodeJS.Signals };

export function attachTerminalWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "", "http://localhost");
      if (url.pathname !== "/ws/terminal") return;
      const token = url.searchParams.get("token") || request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
      const workspaceId = url.searchParams.get("workspaceId") || "";
      const payload = await verifyJwt(token);
      const membership = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: payload.sub, workspaceId } }, include: { workspace: true } });
      if (!membership || !hasPermission(membership.role as WorkspaceRole, "terminal:run")) throw new Error("Permission denied");
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, { userId: payload.sub, workspaceId, rootPath: membership.workspace.rootPath }));
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket, ctx: { userId: string; workspaceId: string; rootPath: string }) => {
    let current: ReturnType<CommandSandbox["run"]> | undefined;
    let output = "";
    ws.send(JSON.stringify({ type: "ready" }));
    ws.on("message", async (raw) => {
      let message: ClientMessage;
      try { message = JSON.parse(raw.toString()); } catch { return ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" })); }
      if (message.type === "run") {
        const dbSession = await prisma.terminalSession.create({ data: { userId: ctx.userId, workspaceId: ctx.workspaceId, command: message.command, cwd: message.cwd ?? "", status: "RUNNING" } });
        current = sandbox.run(message.command, { workspaceRoot: ctx.rootPath, cwd: message.cwd, timeoutMs: message.timeoutMs ?? 60_000 });
        current.on("event", async (event: CommandEvent) => {
          if (event.type === "stdout" || event.type === "stderr") output += event.data;
          ws.send(JSON.stringify(event));
          if (event.type === "exit") {
            await prisma.terminalSession.update({ where: { id: dbSession.id }, data: { status: event.status === "timeout" ? "TIMEOUT" : event.status === "killed" ? "KILLED" : event.status === "error" ? "ERROR" : "EXITED", outputTail: tail(output), exitCode: event.code ?? undefined, endedAt: new Date() } }).catch(() => undefined);
          }
        });
      }
      if (message.type === "input") current?.write(message.data);
      if (message.type === "signal") current?.kill(message.signal ?? "SIGINT");
    });
    ws.on("close", () => current?.kill("SIGTERM"));
  });
}
