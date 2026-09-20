"use client";
import dynamic from "next/dynamic";
import { Save, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../lib/api";
import { useIDEStore } from "../store/ide-store";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CodeEditor() {
  const { tabs, activePath, currentWorkspace, updateTab, closeTab, set } = useIDEStore();
  const active = useMemo(() => tabs.find((tab) => tab.path === activePath), [tabs, activePath]);
  const saveTimer = useRef<number | null>(null);

  async function save(path = activePath) {
    const state = useIDEStore.getState();
    const tab = state.tabs.find((item) => item.path === path);
    const workspace = state.currentWorkspace;
    if (!tab || !workspace || !tab.dirty) return;
    await api(`/api/v1/files/${workspace.id}/write`, { method: "POST", body: JSON.stringify({ path: tab.path, content: tab.content }) });
    state.updateTab(tab.path, { dirty: false });
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <section className="flex h-full min-w-0 flex-col bg-chrome-900">
      <div className="flex h-10 shrink-0 items-center overflow-x-auto border-b border-slate-800 bg-chrome-950">
        {tabs.map((tab) => (
          <button key={tab.path} onClick={() => set({ activePath: tab.path })} className={`group flex h-10 max-w-56 items-center gap-2 border-r border-slate-800 px-3 text-xs ${activePath === tab.path ? "bg-chrome-900 text-cyan-100" : "text-slate-400 hover:bg-slate-900"}`}>
            <span className="truncate">{tab.path.split("/").pop()}</span>{tab.dirty && <span className="text-cyan-300">●</span>}
            <span onClick={(event) => { event.stopPropagation(); closeTab(tab.path); }} className="rounded p-0.5 opacity-0 hover:bg-slate-700 group-hover:opacity-100"><X size={13}/></span>
          </button>
        ))}
        <button onClick={() => save()} className="ml-auto mr-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"><Save size={14}/> Save</button>
      </div>
      <div className="min-h-0 flex-1">
        {active ? (
          <MonacoEditor
            path={active.path}
            language={active.language}
            theme="vs-dark"
            value={active.content}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: "on",
              folding: true,
              automaticLayout: true,
              multiCursorModifier: "ctrlCmd",
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              scrollBeyondLastLine: false
            }}
            onMount={(editor, monaco) => {
              monaco.editor.defineTheme("aeta-dark", { base: "vs-dark", inherit: true, rules: [], colors: { "editor.background": "#0b111c" } });
              monaco.editor.setTheme("aeta-dark");
              editor.addAction({ id: "aeta-save", label: "Aeta: Save File", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => save() });
              editor.onDidChangeCursorSelection(() => set({ selectedCode: editor.getModel()?.getValueInRange(editor.getSelection()!) }));
            }}
            onChange={(value) => {
              updateTab(active.path, { content: value ?? "", dirty: true });
              if (saveTimer.current) window.clearTimeout(saveTimer.current);
              saveTimer.current = window.setTimeout(() => void save(active.path), 1500);
            }}
          />
        ) : (
          <div className="grid h-full place-items-center text-center text-slate-500">
            <div><h2 className="mb-2 text-lg text-slate-300">Open a file to start coding</h2><p>Monaco Editor supports syntax highlighting, IntelliSense, folding, multi-cursor, find/replace, formatting, and keyboard shortcuts.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
