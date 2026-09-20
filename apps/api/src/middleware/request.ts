import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { AppError, fail, hasPermission, type Permission, type WorkspaceRole } from "@aeta/shared";
import { prisma } from "../db/prisma.js";
import { verifyJwt } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string };
      workspaceRole?: WorkspaceRole;
      workspace?: { id: string; rootPath: string; name: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.aeta_session;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;
  if (!token) return next(new AppError("AUTH_REQUIRED", "Authentication is required.", 401));
  verifyJwt(token)
    .then(async (payload) => {
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true } });
      if (!user) throw new AppError("AUTH_INVALID", "User not found.", 401);
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireWorkspace(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("AUTH_REQUIRED", "Authentication is required.", 401);
      const workspaceId = String(req.params.workspaceId || req.params.id || req.body.workspaceId || req.query.workspaceId || "");
      if (!workspaceId) throw new AppError("VALIDATION_ERROR", "workspaceId is required.", 400);
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
        include: { workspace: { select: { id: true, rootPath: true, name: true } } }
      });
      if (!membership) throw new AppError("PERMISSION_DENIED", "You do not have access to this workspace.", 403);
      if (!hasPermission(membership.role as WorkspaceRole, permission)) throw new AppError("PERMISSION_DENIED", "Permission denied.", 403);
      req.workspaceRole = membership.role as WorkspaceRole;
      req.workspace = membership.workspace;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validate<T>(schema: ZodSchema<T>, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      (req as unknown as Record<string, unknown>)[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) next(new AppError("VALIDATION_ERROR", "Invalid request.", 400, error.flatten()));
      else next(error);
    }
  };
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("FILE_NOT_FOUND", "Route not found.", 404));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", error instanceof Error ? error.message : "Internal error", 500, undefined, false);
  res.status(appError.statusCode).json(fail(appError));
}
