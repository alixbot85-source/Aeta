import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "@aeta/shared";
import { resolveWorkspacePath } from "./safe-path.js";

export type SearchOptions = {
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  include?: string;
  exclude?: string;
  limit?: number;
};

export type SearchMatch = {
  file: string;
  line: number;
  column: number;
  text: string;
};

export async function searchWorkspace(root: string, options: SearchOptions): Promise<SearchMatch[]> {
  const resolvedRoot = resolveWorkspacePath(root, "");
  const args = ["--json", "--line-number", "--column", "--hidden", "--glob", "!.git", "--glob", "!node_modules", "--glob", "!.env*"];
  if (!options.regex) args.push("--fixed-strings");
  if (!options.caseSensitive) args.push("--ignore-case");
  if (options.wholeWord) args.push("--word-regexp");
  if (options.include) args.push("--glob", options.include);
  if (options.exclude) args.push("--glob", `!${options.exclude}`);
  args.push(options.query, ".");

  return new Promise((resolve, reject) => {
    const rg = spawn("rg", args, { cwd: resolvedRoot, stdio: ["ignore", "pipe", "pipe"] });
    const results: SearchMatch[] = [];
    let stderr = "";
    let buffer = "";
    const limit = options.limit ?? 500;
    rg.stdout.setEncoding("utf8");
    rg.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "match") {
            const submatch = event.data.submatches?.[0];
            results.push({
              file: event.data.path.text.replace(/\\/g, "/").replace(/^\.\//, ""),
              line: event.data.line_number,
              column: submatch ? submatch.start + 1 : 1,
              text: event.data.lines.text.replace(/\n$/, "")
            });
            if (results.length >= limit) rg.kill("SIGTERM");
          }
        } catch {
          // Ignore malformed ripgrep event lines; stderr/exit code handles real failures.
        }
      }
    });
    rg.stderr.setEncoding("utf8");
    rg.stderr.on("data", (chunk) => { stderr += chunk; });
    rg.on("error", async (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        try {
          resolve(await fallbackSearch(resolvedRoot, options));
        } catch (fallbackError) {
          reject(fallbackError);
        }
      } else reject(error);
    });
    rg.on("close", (code) => {
      if (code === 0 || code === 1 || results.length >= limit || code === null) return resolve(results);
      reject(new AppError("INTERNAL_ERROR", stderr || `ripgrep exited with code ${code}`, 500, undefined, false));
    });
  });
}

async function fallbackSearch(root: string, options: SearchOptions): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  const query = options.caseSensitive ? options.query : options.query.toLowerCase();
  const regex = options.regex ? new RegExp(options.query, options.caseSensitive ? "g" : "gi") : null;
  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if ([".git", "node_modules", ".next", "dist"].includes(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      if (entry.isFile()) {
        const rel = path.relative(root, absolute).replace(/\\/g, "/");
        const text = await fs.readFile(absolute, "utf8").catch(() => "");
        text.split(/\r?\n/).forEach((line, index) => {
          const haystack = options.caseSensitive ? line : line.toLowerCase();
          const found = regex ? regex.exec(line) : { index: haystack.indexOf(query) } as RegExpExecArray;
          if (found && found.index >= 0) matches.push({ file: rel, line: index + 1, column: found.index + 1, text: line });
        });
      }
      if (matches.length >= (options.limit ?? 500)) return;
    }
  }
  await walk(root);
  return matches.slice(0, options.limit ?? 500);
}
