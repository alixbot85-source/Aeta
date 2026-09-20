import path from "node:path";
import { WorkspaceFileSystem, searchWorkspace } from "@aeta/filesystem";

export type ContextInput = {
  userPrompt: string;
  currentFile?: string;
  selectedCode?: string;
  openFiles?: string[];
  errorMessages?: string[];
  terminalOutput?: string;
  gitDiff?: string;
  tokenBudget?: number;
};

export type ContextFile = {
  path: string;
  content: string;
  score: number;
  reason: string;
};

export type ProjectContext = {
  summary: string;
  files: ContextFile[];
  tree: string;
  selectedCode?: string;
  terminalOutput?: string;
  gitDiff?: string;
  truncated: boolean;
};

const IMPORTANT_CONFIGS = [
  "package.json",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "README.md"
];

export class ContextEngine {
  constructor(private readonly workspaceRoot: string) {}

  async build(input: ContextInput): Promise<ProjectContext> {
    const fs = new WorkspaceFileSystem(this.workspaceRoot);
    const treeNodes = await fs.tree("", 3).catch(() => []);
    const tree = renderTree(treeNodes);
    const candidates = new Map<string, ContextFile>();
    let truncated = false;

    const addFile = async (filePath: string, score: number, reason: string) => {
      if (!filePath || candidates.has(filePath)) return;
      const read = await fs.readFile(filePath, 256_000).catch(() => null);
      if (!read) return;
      candidates.set(filePath, { path: filePath, content: read.content, score, reason });
    };

    if (input.currentFile) await addFile(input.currentFile, 100, "current file");
    for (const file of input.openFiles ?? []) await addFile(file, 80, "open file");
    for (const file of IMPORTANT_CONFIGS) await addFile(file, 65, "project configuration");

    const keywords = extractKeywords(input.userPrompt);
    for (const keyword of keywords.slice(0, 6)) {
      const matches = await searchWorkspace(this.workspaceRoot, { query: keyword, caseSensitive: false, regex: false, limit: 20 }).catch(() => []);
      for (const match of matches.slice(0, 6)) await addFile(match.file, 40, `matched search keyword '${keyword}'`);
    }

    for (const file of Array.from(candidates.values())) {
      for (const imported of findRelativeImports(file.path, file.content)) await addFile(imported, file.score - 10, `imported by ${file.path}`);
    }

    const budget = input.tokenBudget ?? 24_000;
    const charBudget = budget * 4;
    let used = tree.length + (input.selectedCode?.length ?? 0) + (input.terminalOutput?.length ?? 0) + (input.gitDiff?.length ?? 0);
    const files: ContextFile[] = [];
    for (const file of Array.from(candidates.values()).sort((a, b) => b.score - a.score)) {
      if (used + file.content.length > charBudget) {
        const remaining = Math.max(0, charBudget - used);
        if (remaining > 1000) {
          files.push({ ...file, content: file.content.slice(0, remaining) + "\n/* ...truncated by context budget... */" });
          used += remaining;
        }
        truncated = true;
        break;
      }
      files.push(file);
      used += file.content.length;
    }

    return {
      summary: `Context selected ${files.length} files from the workspace.`,
      files,
      tree,
      selectedCode: input.selectedCode,
      terminalOutput: truncate(input.terminalOutput, 8000),
      gitDiff: truncate(input.gitDiff, 12000),
      truncated
    };
  }
}

function renderTree(nodes: Array<{ name: string; path: string; type: string; children?: unknown[] }>, depth = 0): string {
  return nodes.map((node) => `${"  ".repeat(depth)}${node.type === "directory" ? "📁" : "📄"} ${node.path}\n${node.children ? renderTree(node.children as never, depth + 1) : ""}`).join("");
}

function extractKeywords(prompt: string): string[] {
  return Array.from(new Set(prompt.toLowerCase().match(/[a-z0-9_./-]{3,}/gi) ?? [])).filter((word) => !["the", "and", "for", "with", "this", "that", "project", "file"].includes(word));
}

function findRelativeImports(filePath: string, content: string): string[] {
  const imports = [...content.matchAll(/(?:from\s+['"]|require\(['"]|import\(['"])(\.\.?\/[^'")]+)/g)].map((match) => match[1]);
  const base = path.posix.dirname(filePath);
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".json", "/index.ts", "/index.tsx", "/index.js"];
  return imports.flatMap((specifier) => extensions.map((ext) => path.posix.normalize(path.posix.join(base, specifier + ext))));
}

function truncate(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.length > limit ? `${value.slice(0, limit)}\n...truncated...` : value;
}
