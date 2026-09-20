export type WorkspaceRole = "OWNER" | "ADMIN" | "MAINTAINER" | "DEVELOPER" | "VIEWER";

export type Permission =
  | "workspace:read"
  | "workspace:update"
  | "workspace:delete"
  | "file:read"
  | "file:write"
  | "file:delete"
  | "terminal:run"
  | "terminal:kill"
  | "project:run"
  | "package:install"
  | "git:read"
  | "git:write"
  | "ai:chat"
  | "agent:run"
  | "settings:read"
  | "settings:write"
  | "member:manage";

const rolePermissions: Record<WorkspaceRole, Set<Permission>> = {
  OWNER: new Set([
    "workspace:read",
    "workspace:update",
    "workspace:delete",
    "file:read",
    "file:write",
    "file:delete",
    "terminal:run",
    "terminal:kill",
    "project:run",
    "package:install",
    "git:read",
    "git:write",
    "ai:chat",
    "agent:run",
    "settings:read",
    "settings:write",
    "member:manage"
  ]),
  ADMIN: new Set([
    "workspace:read",
    "workspace:update",
    "file:read",
    "file:write",
    "file:delete",
    "terminal:run",
    "terminal:kill",
    "project:run",
    "package:install",
    "git:read",
    "git:write",
    "ai:chat",
    "agent:run",
    "settings:read",
    "settings:write",
    "member:manage"
  ]),
  MAINTAINER: new Set([
    "workspace:read",
    "workspace:update",
    "file:read",
    "file:write",
    "file:delete",
    "terminal:run",
    "terminal:kill",
    "project:run",
    "package:install",
    "git:read",
    "git:write",
    "ai:chat",
    "agent:run",
    "settings:read"
  ]),
  DEVELOPER: new Set([
    "workspace:read",
    "file:read",
    "file:write",
    "file:delete",
    "terminal:run",
    "terminal:kill",
    "project:run",
    "package:install",
    "git:read",
    "git:write",
    "ai:chat",
    "agent:run",
    "settings:read"
  ]),
  VIEWER: new Set(["workspace:read", "file:read", "git:read", "ai:chat", "settings:read"])
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return rolePermissions[role]?.has(permission) ?? false;
}

export function assertPermission(role: WorkspaceRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} does not have permission ${permission}`);
  }
}
