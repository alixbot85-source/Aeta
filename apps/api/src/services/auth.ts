import jwt from "jsonwebtoken";
import type { Request } from "express";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { hashToken, randomToken } from "./crypto.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AppError } from "@aeta/shared";
export { hashPassword, verifyPassword } from "./password.js";

export type JwtPayload = { sub: string; sid: string; email: string };

export async function createSession(user: { id: string; email: string }, req?: Request): Promise<{ token: string; expiresAt: Date }> {
  const raw = randomToken(32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const session = await prisma.session.create({
    data: { userId: user.id, tokenHash: hashToken(raw), expiresAt, userAgent: req?.headers["user-agent"], ip: req?.ip }
  });
  const token = jwt.sign({ sub: user.id, sid: session.id, email: user.email } satisfies JwtPayload, env.JWT_SECRET, { expiresIn: "30d" });
  return { token, expiresAt };
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const session = await prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw new AppError("AUTH_INVALID", "Session expired or revoked.", 401);
    return payload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("AUTH_INVALID", "Invalid authentication token.", 401);
  }
}

export async function createEmailVerification(userId: string): Promise<string> {
  const token = randomToken(32);
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
  return token;
}

export async function createPasswordReset(userId: string): Promise<string> {
  const token = randomToken(32);
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 30) } });
  return token;
}
