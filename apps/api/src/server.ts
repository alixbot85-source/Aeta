import http from "node:http";
import fs from "node:fs/promises";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { attachTerminalWebSocket } from "./ws/terminal-ws.js";

await fs.mkdir(env.WORKSPACES_ROOT, { recursive: true });
const app = createApp();
const server = http.createServer(app);
attachTerminalWebSocket(server);
server.listen(env.API_PORT, "0.0.0.0", () => {
  console.log(`Aeta API listening on 0.0.0.0:${env.API_PORT}`);
});
