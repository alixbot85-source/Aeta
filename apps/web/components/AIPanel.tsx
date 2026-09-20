"use client";
import { Bot, Send, ShieldCheck, Wrench } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import { useIDEStore } from "../store/ide-store";
import { DiffReview, type PendingChange } from "./DiffReview";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export function AIPanel() {
  const { currentWorkspace, activePath, tabs, selectedCode, terminalOutput, gitDiff } = useIDEStore();
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "system", content: "DeepSeek is the only AI provider configured. Context is selected on the backend." }]);
  const [input, setInput] = useState("Analyze this project and summarize the architecture.");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [allowCommands, setAllowCommands] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  async function send() {
    if (!currentWorkspace || !input.trim()) return;
    const payload = { message: input, request: input, currentFile: activePath, selectedCode, openFiles: tabs.map((tab) => tab.path), terminalOutput, gitDiff };
    const userMessage = input;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: userMessage }]);
    setLoading(true);
    try {
      if (mode === "chat") {
        const data = await api<{ message: string; contextSummary: string; usage?: unknown }>(`/api/v1/ai/${currentWorkspace.id}/chat`, { method: "POST", body: JSON.stringify(payload) });
        setMessages((items) => [...items, { role: "assistant", content: `${data.message}\n\nContext: ${data.contextSummary}` }]);
      } else {
        const data = await api<{ finalMessage: string; pendingChanges: PendingChange[]; toolCalls: Array<{ tool: string; status: string }> }>(`/api/v1/agent/${currentWorkspace.id}/run`, { method: "POST", body: JSON.stringify({ ...payload, allowCommands }) });
        setPendingChanges(data.pendingChanges);
        setMessages((items) => [...items, { role: "assistant", content: `${data.finalMessage || "Agent completed."}\n\nTools: ${data.toolCalls.map((t) => `${t.tool}:${t.status}`).join(", ") || "none"}\nPending changes: ${data.pendingChanges.length}` }]);
      }
    } catch (err) {
      setMessages((items) => [...items, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "AI request failed"}` }]);
    } finally { setLoading(false); }
  }

  return (
    <aside className="flex h-full flex-col border-l border-slate-800 bg-chrome-900 text-sm">
      <div className="flex h-10 items-center justify-between border-b border-slate-800 px-3">
        <div className="flex items-center gap-2 font-medium text-slate-200"><Bot size={16}/> DeepSeek</div>
        <div className="flex rounded-md bg-slate-950 p-1 text-xs">
          <button onClick={() => setMode("chat")} className={`rounded px-2 py-1 ${mode === "chat" ? "bg-slate-700 text-cyan-100" : "text-slate-400"}`}>Chat</button>
          <button onClick={() => setMode("agent")} className={`rounded px-2 py-1 ${mode === "agent" ? "bg-slate-700 text-cyan-100" : "text-slate-400"}`}>Agent</button>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 space-y-3 overflow-auto p-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-100"><ShieldCheck className="mr-1 inline" size={14}/> DeepSeek API key remains server-side. No fallback AI provider exists.</div>
        {mode === "agent" && <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300"><input type="checkbox" checked={allowCommands} onChange={(e) => setAllowCommands(e.target.checked)} /> Allow real command execution for this run</label>}
        {messages.map((message, index) => <MessageBubble key={index} message={message} />)}
        {loading && <div className="animate-pulse rounded-lg bg-slate-800 p-3 text-slate-400">Waiting for backend/DeepSeek...</div>}
      </div>
      <DiffReview changes={pendingChanges} onUpdated={() => setPendingChanges([])} />
      <div className="border-t border-slate-800 p-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }} rows={4} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-2 outline-none focus:border-cyan-500" placeholder={mode === "agent" ? "Ask the agent to inspect, plan, propose diffs, and run checks..." : "Ask DeepSeek about this workspace..."}/>
        <button onClick={send} disabled={loading || !currentWorkspace} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"><Send size={15}/>{mode === "agent" ? <><Wrench size={15}/>Run Agent</> : "Send"}</button>
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const color = message.role === "user" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-50" : message.role === "system" ? "border-slate-700 bg-slate-950 text-slate-400" : "border-slate-700 bg-slate-900 text-slate-200";
  return <div className={`whitespace-pre-wrap rounded-lg border p-3 ${color}`}>{message.content}</div>;
}
