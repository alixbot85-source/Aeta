"use client";
import { ChevronDown, ChevronRight, File, Folder, FolderPlus, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { languageFromPath, useIDEStore, type FileNode } from "../store/ide-store";

export function FileExplorer() {
  const { currentWorkspace, tree, set, tabs } = useIDEStore();
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!currentWorkspace) return <aside className="border-r border-slate-800 bg-chrome-900 p-3 text-sm text-slate-400">Create or select a workspace.</aside>;

  async function refresh() {
    const data = await api<{ tree: FileNode[] }>(`/api/v1/files/${currentWorkspace!.id}/tree?depth=6`);
    set({ tree: data.tree });
  }

  async function openFile(path: string) {
    setError(null);
    try {
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) return set({ activePath: path });
      const data = await api<{ file: { path: string; content: string; hash: string } }>(`/api/v1/files/${currentWorkspace!.id}/read?path=${encodeURIComponent(path)}`);
      set({ tabs: [...tabs, { path, content: data.file.content, dirty: false, language: languageFromPath(path), hash: data.file.hash }], activePath: path });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to open file"); }
  }

  async function create(kind: "file" | "folder") {
    const path = prompt(kind === "file" ? "New file path" : "New folder path");
    if (!path) return;
    await api(`/api/v1/files/${currentWorkspace!.id}/${kind === "file" ? "create" : "mkdir"}`, { method: "POST", body: JSON.stringify({ path, content: "" }) });
    await refresh();
  }

  async function remove(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    await api(`/api/v1/files/${currentWorkspace!.id}?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    await refresh();
  }

  const filtered = filter ? filterTree(tree, filter.toLowerCase()) : tree;
  return (
    <aside className="flex h-full flex-col border-r border-slate-800 bg-chrome-900 text-sm">
      <div className="flex h-10 items-center justify-between border-b border-slate-800 px-3">
        <span className="font-medium text-slate-200">Explorer</span>
        <div className="flex gap-1">
          <button title="New File" onClick={() => create("file")} className="rounded p-1 text-slate-400 hover:bg-slate-800"><Plus size={15}/></button>
          <button title="New Folder" onClick={() => create("folder")} className="rounded p-1 text-slate-400 hover:bg-slate-800"><FolderPlus size={15}/></button>
          <button title="Refresh" onClick={refresh} className="rounded p-1 text-slate-400 hover:bg-slate-800"><RefreshCcw size={15}/></button>
        </div>
      </div>
      <label className="m-2 flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-400">
        <Search size={14}/><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files" className="w-full bg-transparent outline-none" />
      </label>
      {error && <div className="mx-2 mb-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
      <div className="scrollbar-thin flex-1 overflow-auto px-1 pb-4">
        {filtered.map((node) => <TreeNode key={node.path} node={node} depth={0} openFile={openFile} remove={remove} />)}
      </div>
    </aside>
  );
}

function TreeNode({ node, depth, openFile, remove }: { node: FileNode; depth: number; openFile: (path: string) => void; remove: (path: string) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.type === "directory";
  return (
    <div>
      <div draggable onDragStart={(event) => event.dataTransfer.setData("text/aeta-path", node.path)} onDrop={(event) => { event.preventDefault(); const from = event.dataTransfer.getData("text/aeta-path"); if (from && isDir) movePath(from, node.path); }} onDragOver={(event) => isDir && event.preventDefault()} className="group flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-slate-300 hover:bg-slate-800" style={{ paddingLeft: depth * 12 + 4 }} onClick={() => isDir ? setOpen(!open) : openFile(node.path)}>
        {isDir ? (open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span className="w-[14px]" />}
        {isDir ? <Folder size={15} className="text-cyan-300"/> : <File size={15} className="text-slate-400"/>}
        <span className="truncate">{node.name}</span>
        <button onClick={(event) => { event.stopPropagation(); remove(node.path); }} className="ml-auto hidden rounded p-0.5 text-slate-500 hover:text-red-300 group-hover:block"><Trash2 size={13}/></button>
      </div>
      {isDir && open && node.children?.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} openFile={openFile} remove={remove} />)}
    </div>
  );
}

async function movePath(from: string, directory: string) {
  const state = useIDEStore.getState();
  const to = `${directory}/${from.split("/").pop()}`;
  await api(`/api/v1/files/${state.currentWorkspace!.id}/move`, { method: "POST", body: JSON.stringify({ from, to }) });
  const data = await api<{ tree: FileNode[] }>(`/api/v1/files/${state.currentWorkspace!.id}/tree?depth=6`);
  state.set({ tree: data.tree });
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  return nodes.flatMap((node) => {
    const children = node.children ? filterTree(node.children, query) : [];
    if (node.name.toLowerCase().includes(query) || children.length) return [{ ...node, children }];
    return [];
  });
}
