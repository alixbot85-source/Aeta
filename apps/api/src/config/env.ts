import path from "node:path";
import { z } from "zod";
import { DEEPSEEK_DEFAULT_BASE_URL, DEEPSEEK_DEFAULT_MODEL } from "@aeta/ai";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default("development-only-jwt-secret-change-me"),
  ENCRYPTION_KEY: z.string().default("development-only-32-byte-key-000000"),
  WORKSPACES_ROOT: z.string().default(path.resolve(process.cwd(), ".workspaces")),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default(DEEPSEEK_DEFAULT_MODEL),
  DEEPSEEK_BASE_URL: z.string().url().default(DEEPSEEK_DEFAULT_BASE_URL)
});

export const env = envSchema.parse(process.env);
