import type { Request } from "express";
import { prisma } from "../db/prisma.js";

export async function audit(req: Request, action: string, resource?: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      workspaceId: req.workspace?.id,
      action,
      resource,
      metadata,
      ip: req.ip
    }
  }).catch(() => undefined);
}
