import { Router } from "express";
import { z } from "zod";
import { AppError, ok } from "@aeta/shared";
import { prisma } from "../db/prisma.js";
import { authRateLimit } from "../middleware/security.js";
import { requireAuth, validate } from "../middleware/request.js";
import { createEmailVerification, createPasswordReset, createSession, hashPassword, verifyPassword } from "../services/auth.js";
import { hashToken } from "../services/crypto.js";
import { env } from "../config/env.js";
import { audit } from "../services/audit.js";

export const authRouter = Router();

authRouter.use(authRateLimit);

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(10).max(200), name: z.string().max(120).optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof registerSchema>;
    const exists = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) throw new AppError("VALIDATION_ERROR", "Email is already registered.", 409);
    const user = await prisma.user.create({ data: { email: body.email.toLowerCase(), name: body.name, passwordHash: await hashPassword(body.password) } });
    const verificationToken = await createEmailVerification(user.id);
    const session = await createSession(user, req);
    await audit(req, "auth.register", `user:${user.id}`);
    res.cookie("aeta_session", session.token, cookieOptions(session.expiresAt));
    res.status(201).json(ok({
      user: publicUser(user),
      token: session.token,
      expiresAt: session.expiresAt,
      emailVerification: env.NODE_ENV === "production" ? "Email delivery must be configured on the server." : { token: verificationToken }
    }));
  } catch (error) { next(error); }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw new AppError("AUTH_INVALID", "Invalid email or password.", 401);
    const session = await createSession(user, req);
    await audit(req, "auth.login", `user:${user.id}`);
    res.cookie("aeta_session", session.token, cookieOptions(session.expiresAt));
    res.json(ok({ user: publicUser(user), token: session.token, expiresAt: session.expiresAt }));
  } catch (error) { next(error); }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await prisma.session.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, "auth.logout");
    res.clearCookie("aeta_session");
    res.json(ok({ loggedOut: true }));
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(ok({ user: req.user }));
});

authRouter.post("/verify-email", validate(z.object({ token: z.string().min(10) })), async (req, res, next) => {
  try {
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(String(req.body.token)) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError("VALIDATION_ERROR", "Verification token is invalid or expired.", 400);
    await prisma.$transaction([
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } })
    ]);
    res.json(ok({ verified: true }));
  } catch (error) { next(error); }
});

authRouter.post("/password/forgot", validate(z.object({ email: z.string().email() })), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: String(req.body.email).toLowerCase() } });
    let devToken: string | undefined;
    if (user) devToken = await createPasswordReset(user.id);
    res.json(ok({ sent: true, ...(env.NODE_ENV === "production" ? {} : { resetToken: devToken }) }));
  } catch (error) { next(error); }
});

authRouter.post("/password/reset", validate(z.object({ token: z.string().min(10), password: z.string().min(10).max(200) })), async (req, res, next) => {
  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(String(req.body.token)) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError("VALIDATION_ERROR", "Reset token is invalid or expired.", 400);
    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(String(req.body.password)) } }),
      prisma.session.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } })
    ]);
    res.json(ok({ reset: true }));
  } catch (error) { next(error); }
});

function cookieOptions(expires: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", expires };
}

function publicUser(user: { id: string; email: string; name: string | null; role: string; emailVerifiedAt?: Date | null }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerifiedAt: user.emailVerifiedAt ?? null };
}
