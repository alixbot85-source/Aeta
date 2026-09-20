import { Router } from "express";
import { z } from "zod";
import { ok } from "@aeta/shared";
import { requireAuth, validate } from "../middleware/request.js";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { encryptSecret } from "../services/crypto.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { settings: true } });
    res.json(ok({ settings: user?.settings ?? {}, ai: deepSeekSettings() }));
  } catch (error) { next(error); }
});

settingsRouter.patch("/", validate(z.object({ settings: z.record(z.unknown()) })), async (req, res, next) => {
  try {
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { settings: req.body.settings } });
    res.json(ok({ settings: user.settings }));
  } catch (error) { next(error); }
});

settingsRouter.get("/ai", (_req, res) => {
  res.json(ok({ ai: deepSeekSettings() }));
});

settingsRouter.get("/api-keys", async (req, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({ where: { userId: req.user!.id }, select: { id: true, name: true, kind: true, createdAt: true, lastUsedAt: true } });
    res.json(ok({ keys, deepSeek: { provider: "DeepSeek", source: "server_environment", configured: Boolean(env.DEEPSEEK_API_KEY) } }));
  } catch (error) { next(error); }
});

settingsRouter.post("/api-keys", validate(z.object({ name: z.string().min(1), kind: z.enum(["github", "generic"]), value: z.string().min(1) })), async (req, res, next) => {
  try {
    const encrypted = encryptSecret(req.body.value);
    const key = await prisma.apiKey.create({ data: { userId: req.user!.id, name: req.body.name, kind: req.body.kind, ...encrypted } });
    res.status(201).json(ok({ key: { id: key.id, name: key.name, kind: key.kind, createdAt: key.createdAt } }));
  } catch (error) { next(error); }
});

settingsRouter.delete("/api-keys/:id", async (req, res, next) => {
  try {
    await prisma.apiKey.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    res.json(ok({ deleted: true }));
  } catch (error) { next(error); }
});

function deepSeekSettings() {
  return {
    provider: "DeepSeek",
    model: env.DEEPSEEK_MODEL,
    baseUrl: env.DEEPSEEK_BASE_URL,
    configured: Boolean(env.DEEPSEEK_API_KEY),
    streaming: true,
    temperatureSupported: true,
    maxTokensSupported: true
  };
}
