"use client";
import { Bot, FolderTree, PanelBottom, PanelRight, Play, Settings, GitBranch } from "lucide-react";
import { useIDEStore } from "../store/ide-store";

export function TopBar({ onRun, onSettings }: { onRun: () => void; onSettings: () => void }) {
  const { currentWorkspace, explorerOpen, aiOpen, bottomOpen, set } = useIDEStore();
  return (
    <header className="flex h-11 items-center justify-between border-b border-slate-800 bg-chrome-950 px-3 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500 font-bold text-slate-950">A</div>
        <span className="font-medium text-slate-200">Aeta</span>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">{currentWorkspace?.name ?? "No workspace"}</span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton active={explorerOpen} title="Toggle Explorer" onClick={() => set({ explorerOpen: !explorerOpen })}><FolderTree size={16}/></IconButton>
        <IconButton title="Run Project" onClick={onRun}><Play size={16}/></IconButton>
        <IconButton title="Git" onClick={() => set({ bottomOpen: true, bottomTab: "git" })}><GitBranch size={16}/></IconButton>
        <IconButton active={bottomOpen} title="Toggle Bottom Panel" onClick={() => set({ bottomOpen: !bottomOpen })}><PanelBottom size={16}/></IconButton>
        <IconButton active={aiOpen} title="Toggle AI" onClick={() => set({ aiOpen: !aiOpen })}><PanelRight size={16}/><Bot size={14}/></IconButton>
        <IconButton title="Settings" onClick={onSettings}><Settings size={16}/></IconButton>
      </div>
    </header>
  );
}

function IconButton({ children, title, active, onClick }: { children: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return <button title={title} onClick={onClick} className={`inline-flex h-8 items-center gap-1 rounded-md px-2 hover:bg-slate-800 ${active ? "bg-slate-800 text-cyan-200" : "text-slate-400"}`}>{children}</button>;
}
