import { create } from "zustand";

export type FileNode = { name: string; path: string; type: "file" | "directory"; size?: number; children?: FileNode[] };
export type OpenTab = { path: string; content: string; dirty: boolean; language: string; hash?: string };
export type Workspace = { id: string; name: string; rootPath: string; role?: string; projects?: Array<{ id: string; name: string; startCommand?: string }> };
export type PanelTab = "terminal" | "problems" | "output" | "git";

export type IDEState = {
  token: string | null;
  user: { id: string; email: string; name?: string | null } | null;
  workspaces: Workspace[];
  currentWorkspace?: Workspace;
  tree: FileNode[];
  tabs: OpenTab[];
  activePath?: string;
  selectedCode?: string;
  bottomOpen: boolean;
  aiOpen: boolean;
  explorerOpen: boolean;
  bottomTab: PanelTab;
  terminalOutput: string;
  problems: Array<{ file: string; line: number; column: number; message: string; severity: "error" | "warning" | "info" }>;
  gitDiff: string;
  set: (patch: Partial<IDEState>) => void;
  updateTab: (path: string, patch: Partial<OpenTab>) => void;
  closeTab: (path: string) => void;
};

export const useIDEStore = create<IDEState>((set) => ({
  token: null,
  user: null,
  workspaces: [],
  tree: [],
  tabs: [],
  bottomOpen: true,
  aiOpen: true,
  explorerOpen: true,
  bottomTab: "terminal",
  terminalOutput: "",
  problems: [],
  gitDiff: "",
  set,
  updateTab: (path, patch) => set((state) => ({ tabs: state.tabs.map((tab) => (tab.path === path ? { ...tab, ...patch } : tab)) })),
  closeTab: (path) => set((state) => {
    const tabs = state.tabs.filter((tab) => tab.path !== path);
    const activePath = state.activePath === path ? tabs.at(-1)?.path : state.activePath;
    return { tabs, activePath };
  })
}));

export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", html: "html", css: "css", json: "json", py: "python", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", go: "go", rs: "rust", php: "php", sql: "sql", md: "markdown", yml: "yaml", yaml: "yaml", sh: "shell", bash: "shell"
  };
  return map[ext || ""] || "plaintext";
}
