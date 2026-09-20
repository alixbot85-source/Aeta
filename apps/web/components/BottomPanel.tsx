"use client";
import { AlertTriangle, GitBranch, Play, SquareTerminal, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, terminalUrl } from "../lib/api";
import { useIDEStore, type PanelTab } from "../store/ide-store";

export function BottomPanel() {
  const { bottomTab, set } = useIDEStore();
  return (
    <section className="flex h-full flex-col border-t border-slate-800 bg-chrome-950 text-sm">
      <div className="flex h-9 items-center border-b border-slate-800">
        <Tab id="terminal" icon={<SquareTerminal size={15}/>} label="Terminal" />
        <Tab id="problems" icon={<AlertTriangle size={15}/>} label="Problems" />
        <Tab id="output" icon={<Play size={15}/>} label="Output" />
        <Tab id="git" icon={<GitBranch size={15}/>} label="Git" />
        <button className="ml-auto mr-2 rounded p-1 text-slate-500 hover:bg-slate-800" onClick={() => set({ bottomOpen: false })}><XCircle size={16}/></button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {bottomTab === "terminal" && <TerminalView />}
        {bottomTab === "problems" && <ProblemsView />}
        {bottomTab === "output" && <OutputView />}
        {bottomTab === "git" && <GitView />}
      </div>
    </section>
  );
}

function Tab({ id, icon, label }: { id: PanelTab; icon: React.ReactNode; label: string }) {
  const { bottomTab, set } = useIDEStore();
  return <button onClick={() => set({ bottomTab: id })} className={`flex h-9 items-center gap-2 border-r border-slate-800 px-3 text-xs ${bottomTab === id ? "bg-chrome-900 text-cyan-100" : "text-slate-400 hover:bg-slate-900"}`}>{icon}{label}</button>;
}

function TerminalView() {
  const workspace = useIDEStore((state) => state.currentWorkspace);
  const setStore = useIDEStore((state) => state.set);
  const [command, setCommand] = useState("npm install");
  const [lines, setLines] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); setStore({ terminalOutput: lines.join("") }); }, [lines, setStore]);

  function connect(): WebSocket | null {
    if (!workspace) return null;
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current;
    const ws = new WebSocket(terminalUrl(workspace.id));
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stdout" || data.type === "stderr") setLines((items) => [...items, data.data]);
      if (data.type === "exit") setLines((items) => [...items, `\n[process exited: ${data.code ?? data.signal}]\n`]);
      if (data.type === "ready") setLines((items) => [...items, "[terminal connected]\n"]);
    };
    ws.onclose = () => setLines((items) => [...items, "[terminal disconnected]\n"]);
    wsRef.current = ws;
    return ws;
  }

  function run() {
    const ws = connect();
    if (!ws) return;
    const send = () => ws.send(JSON.stringify({ type: "run", command }));
    if (ws.readyState === WebSocket.OPEN) send(); else ws.addEventListener("open", send, { once: true });
    setLines((items) => [...items, `\n$ ${command}\n`]);
  }

  function interrupt() { wsRef.current?.send(JSON.stringify({ type: "signal", signal: "SIGINT" })); }

  return <div className="flex h-full flex-col"><pre className="scrollbar-thin flex-1 overflow-auto p-3 font-mono text-xs text-slate-200"><code>{lines.join("")}</code><span ref={bottomRef}/></pre><div className="flex border-t border-slate-800 p-2"><span className="px-2 py-1 font-mono text-cyan-300">$</span><input className="flex-1 rounded bg-slate-900 px-2 py-1 font-mono text-sm outline-none" value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} /><button onClick={run} className="ml-2 rounded bg-cyan-500 px-3 py-1 text-slate-950">Run</button><button onClick={interrupt} className="ml-2 rounded bg-red-500/20 px-3 py-1 text-red-200">Ctrl+C</button></div></div>;
}

function ProblemsView() {
  const problems = useIDEStore((state) => state.problems);
  const set = useIDEStore((state) => state.set);
  return <div className="scrollbar-thin h-full overflow-auto p-3">{problems.length ? problems.map((p, i) => <button key={i} onClick={() => set({ activePath: p.file })} className="block w-full rounded px-2 py-1 text-left hover:bg-slate-800"><span className={p.severity === "error" ? "text-red-300" : p.severity === "warning" ? "text-amber-300" : "text-slate-300"}>{p.severity}</span> {p.file}:{p.line}:{p.column} — {p.message}</button>) : <p className="text-slate-500">No problems reported yet. Language diagnostics appear in Monaco; backend lint/test commands can populate this panel.</p>}</div>;
}

function OutputView() {
  const output = useIDEStore((state) => state.terminalOutput);
  return <pre className="scrollbar-thin h-full overflow-auto p-3 font-mono text-xs text-slate-300"><code>{output || "No output yet."}</code></pre>;
}

function GitView() {
  const workspace = useIDEStore((state) => state.currentWorkspace);
  const setStore = useIDEStore((state) => state.set);
  const [status, setStatus] = useState<string>("");
  const [diff, setDiff] = useState("");
  async function refresh() {
    if (!workspace) return;
    const statusData = await api<{ status: { branch: string; files: Array<{ path: string; index: string; workingTree: string }> } }>(`/api/v1/git/${workspace.id}/status`);
    const diffData = await api<{ diff: string }>(`/api/v1/git/${workspace.id}/diff`);
    setStatus(`${statusData.status.branch}\n${statusData.status.files.map((f) => `${f.index}${f.workingTree} ${f.path}`).join("\n")}`);
    setDiff(diffData.diff);
    setStore({ gitDiff: diffData.diff });
  }
  async function init() { if (workspace) { await api(`/api/v1/git/${workspace.id}/init`, { method: "POST" }); await refresh(); } }
  return <div className="flex h-full flex-col"><div className="flex gap-2 border-b border-slate-800 p-2"><button onClick={refresh} className="rounded bg-slate-800 px-2 py-1">Refresh</button><button onClick={init} className="rounded bg-slate-800 px-2 py-1">Init Repository</button></div><div className="grid min-h-0 flex-1 grid-cols-3"><pre className="scrollbar-thin overflow-auto border-r border-slate-800 p-3 font-mono text-xs text-slate-300"><code>{status || "No status loaded."}</code></pre><pre className="scrollbar-thin col-span-2 overflow-auto p-3 font-mono text-xs text-slate-300"><code>{diff || "No diff."}</code></pre></div></div>;
}
