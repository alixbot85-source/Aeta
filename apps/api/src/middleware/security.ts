import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = env.API_CORS_ORIGIN.split(",").map((value) => value.trim());
    if (allowed.includes(origin) || allowed.includes("*")) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true
});

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
