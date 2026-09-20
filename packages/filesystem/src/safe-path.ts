import path from "node:path";
import { AppError } from "@aeta/shared";

export const DEFAULT_EXCLUDED_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache"
]);

export const SECRET_FILE_PATTERNS = [/^\.env(\..*)?$/i, /\.pem$/i, /\.key$/i, /^id_rsa$/i, /^id_ed25519$/i];

export function normalizeRelativePath(input = ""): string {
  const raw = input.replace(/\\/g, "/").trim();
  if (raw.includes("\0")) throw new AppError("PATH_TRAVERSAL_BLOCKED", "Path contains a null byte.", 400);
  const withoutLeading = raw.replace(/^\/+/, "");
  const normalized = path.posix.normalize(withoutLeading);
  if (normalized === ".") return "";
  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(raw)) {
    throw new AppError("PATH_TRAVERSAL_BLOCKED", "Path traversal is not allowed.", 400);
  }
  return normalized;
}

export function resolveWorkspacePath(workspaceRoot: string, input = ""): string {
  const root = path.resolve(workspaceRoot);
  const rel = normalizeRelativePath(input);
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new AppError("PATH_TRAVERSAL_BLOCKED", "Path escapes the workspace root.", 400);
  }
  return resolved;
}

export function assertSafeToExpose(relativePath: string): void {
  const segments = normalizeRelativePath(relativePath).split("/").filter(Boolean);
  for (const segment of segments) {
    if (SECRET_FILE_PATTERNS.some((pattern) => pattern.test(segment))) {
      throw new AppError("PERMISSION_DENIED", "Secret files are not exposed through the file API.", 403);
    }
  }
}

export function shouldSkipEntry(name: string): boolean {
  return DEFAULT_EXCLUDED_NAMES.has(name);
}
