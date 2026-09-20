import { z } from "zod";

export const relativePathSchema = z
  .string()
  .min(0)
  .max(4096)
  .refine((value) => !value.includes("\0"), "Path contains a null byte")
  .refine((value) => !/^[a-zA-Z]:/.test(value), "Windows drive paths are not allowed");

export const workspaceIdSchema = z.string().uuid();
export const projectIdSchema = z.string().uuid();

export const fileWriteSchema = z.object({
  path: relativePathSchema,
  content: z.string().max(10 * 1024 * 1024),
  baseVersion: z.number().int().nonnegative().optional()
});

export const searchSchema = z.object({
  query: z.string().min(1).max(500),
  regex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(false),
  include: z.string().max(500).optional(),
  exclude: z.string().max(500).optional(),
  limit: z.number().int().positive().max(2000).default(500)
});
