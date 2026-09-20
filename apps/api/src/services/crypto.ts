import crypto from "node:crypto";
import { env } from "../config/env.js";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function encryptSecret(value: string): { encryptedKey: string; iv: string; authTag: string } {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { encryptedKey: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(input: { encryptedKey: string; iv: string; authTag: string }): string {
  const key = encryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.encryptedKey, "base64")), decipher.final()]).toString("utf8");
}

function encryptionKey(): Buffer {
  const raw = env.ENCRYPTION_KEY;
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  return crypto.createHash("sha256").update(raw).digest();
}
