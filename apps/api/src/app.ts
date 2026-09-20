import express from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authRouter } from "./routes/auth.js";
import { workspacesRouter } from "./routes/workspaces.js";
import { filesRouter } from "./routes/files.js";
import { searchRouter } from "./routes/search.js";
import { aiRouter } from "./routes/ai.js";
import { agentRouter } from "./routes/agent.js";
import { terminalRouter } from "./routes/terminal.js";
import { gitRouter } from "./routes/git.js";
import { settingsRouter } from "./routes/settings.js";
import { projectsRouter } from "./routes/projects.js";
import { usersRouter } from "./routes/users.js";
import { apiRateLimit, corsMiddleware, helmetMiddleware } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/request.js";
import { redactSecrets } from "@aeta/shared";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(apiRateLimit);
  app.use(express.json({ limit: "25mb" }));
  app.use(cookieParser());
  app.use((pinoHttp as unknown as (options: Record<string, unknown>) => express.RequestHandler)({
    redact: ["req.headers.authorization", "req.cookies", "res.headers.set-cookie"],
    serializers: {
      err: (error: unknown) => redactSecrets(error)
    }
  }));

  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/workspaces", workspacesRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/files", filesRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/agent", agentRouter);
  app.use("/api/v1/terminal", terminalRouter);
  app.use("/api/v1/git", gitRouter);
  app.use("/api/v1/settings", settingsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
