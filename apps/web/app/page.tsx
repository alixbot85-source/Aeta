"use client";
import { useEffect, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { LoginScreen } from "../components/LoginScreen";
import { TopBar } from "../components/TopBar";
import { FileExplorer } from "../components/FileExplorer";
import { CodeEditor } from "../components/CodeEditor";
import { AIPanel } from "../components/AIPanel";
import { BottomPanel } from "../components/BottomPanel";
import { SettingsDrawer } from "../components/SettingsDrawer";
import { useIDEStore, type FileNode, type Workspace } from "../store/ide-store";

export default function HomePage() {
  const store = useIDEStore();
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(380);
  const [bottomHeight, setBottomHeight] = useState(260);

  useEffect(() => { void bootstrap(); }, []);

  async function bootstrap() {
    const token = getToken();
    if (!token) return setReady(true);
    try {
      const me = await api<{ user: { id: string; email: string } }>("/api/v1/auth/me");
      store.set({ token, user: me.user });
      await loadWorkspaces();
    } catch {
      setToken(null);
    } finally { setReady(true); }
  }

  async function loadWorkspaces() {
    const data = await api<{ workspaces: Workspace[] }>("/api/v1/workspaces");
    let workspace = data.workspaces[0];
    if (!workspace) {
      const created = await api<{ workspace: Workspace }>("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name: "Aeta Workspace", template: "react" }) });
      workspace = created.workspace;
    }
    store.set({ workspaces: data.workspaces, currentWorkspace: workspace });
    const tree = await api<{ tree: FileNode[] }>(`/api/v1/files/${workspace.id}/tree?depth=6`);
    store.set({ tree: tree.tree });
  }

  async function createWorkspace() {
    const name = prompt("Workspace name", "New Workspace");
    if (!name) return;
    const template = prompt("Template: nextjs, react, vue, vite, node, python, fastapi, express, html", "react") || "react";
    const data = await api<{ workspace: Workspace }>("/api/v1/workspaces", { method: "POST", body: JSON.stringify({ name, template }) });
    store.set({ currentWorkspace: data.workspace });
    await loadWorkspaces();
  }

  async function runProject() {
    const workspace = store.currentWorkspace;
    if (!workspace) return;
    store.set({ bottomOpen: true, bottomTab: "terminal" });
    alert("Use the Terminal panel to run the start command. The backend executes real commands in the workspace sandbox and streams output.");
  }

  if (!ready) return <div className="grid min-h-screen place-items-center bg-chrome-950 text-slate-400">Loading Aeta...</div>;
  if (!store.token) return <LoginScreen onReady={loadWorkspaces} />;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-chrome-950 text-slate-100">
      <TopBar onRun={runProject} onSettings={() => setSettingsOpen(true)} />
      <div className="flex h-[calc(100vh-44px)] min-h-0 flex-1">
        {store.explorerOpen && <Resizable width={leftWidth} onResize={setLeftWidth} side="right"><div className="flex h-full flex-col"><WorkspaceSwitcher onCreate={createWorkspace}/><FileExplorer /></div></Resizable>}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1"><CodeEditor /></div>
          {store.bottomOpen && <ResizableHorizontal height={bottomHeight} onResize={setBottomHeight}><BottomPanel /></ResizableHorizontal>}
        </div>
        {store.aiOpen && <Resizable width={rightWidth} onResize={setRightWidth} side="left"><AIPanel /></Resizable>}
      </div>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function WorkspaceSwitcher({ onCreate }: { onCreate: () => void }) {
  const { workspaces, currentWorkspace, set } = useIDEStore();
  async function select(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    if (!workspace) return;
    set({ currentWorkspace: workspace, tabs: [], activePath: undefined });
    const tree = await api<{ tree: FileNode[] }>(`/api/v1/files/${workspace.id}/tree?depth=6`);
    set({ tree: tree.tree });
  }
  return <div className="flex h-11 items-center gap-2 border-r border-b border-slate-800 bg-chrome-950 px-2"><select className="min-w-0 flex-1 rounded bg-slate-900 px-2 py-1 text-sm" value={currentWorkspace?.id} onChange={(e) => select(e.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><button onClick={onCreate} className="rounded bg-slate-800 px-2 py-1 text-xs">New</button></div>;
}

function Resizable({ width, onResize, side, children }: { width: number; onResize: (width: number) => void; side: "left" | "right"; children: React.ReactNode }) {
  return <div className="relative h-full shrink-0" style={{ width }}>{children}<div onMouseDown={(event) => startResize(event, onResize, width, side)} className={`absolute top-0 h-full w-1 cursor-col-resize hover:bg-cyan-500 ${side === "right" ? "right-0" : "left-0"}`} /></div>;
}

function ResizableHorizontal({ height, onResize, children }: { height: number; onResize: (height: number) => void; children: React.ReactNode }) {
  return <div className="relative shrink-0" style={{ height }}><div onMouseDown={(event) => { const startY = event.clientY; const start = height; const move = (e: MouseEvent) => onResize(Math.min(520, Math.max(140, start - (e.clientY - startY)))); const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }} className="absolute -top-1 left-0 h-2 w-full cursor-row-resize hover:bg-cyan-500/50" />{children}</div>;
}

function startResize(event: React.MouseEvent, onResize: (width: number) => void, width: number, side: "left" | "right") {
  const startX = event.clientX;
  const start = width;
  const move = (e: MouseEvent) => {
    const delta = side === "right" ? e.clientX - startX : startX - e.clientX;
    onResize(Math.min(620, Math.max(180, start + delta)));
  };
  const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}
