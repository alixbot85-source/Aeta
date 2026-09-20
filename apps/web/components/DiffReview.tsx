"use client";
import { Check, X } from "lucide-react";
import { api } from "../lib/api";
import { useIDEStore } from "../store/ide-store";

export type PendingChange = { id: string; path: string; kind: string; diff: string; status?: string };

export function DiffReview({ changes, onUpdated }: { changes: PendingChange[]; onUpdated: () => void }) {
  const workspace = useIDEStore((state) => state.currentWorkspace);
  if (!changes.length || !workspace) return null;
  async function accept(id: string) {
    await api(`/api/v1/agent/${workspace!.id}/changes/${id}/accept`, { method: "POST" });
    onUpdated();
  }
  async function reject(id: string) {
    await api(`/api/v1/agent/${workspace!.id}/changes/${id}/reject`, { method: "POST" });
    onUpdated();
  }
  return (
    <div className="space-y-3 border-t border-slate-800 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diff review</div>
      {changes.map((change) => (
        <article key={change.id} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs">
            <span className="truncate text-slate-300">{change.kind}: {change.path}</span>
            <div className="flex gap-1">
              <button onClick={() => accept(change.id)} className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-emerald-200 hover:bg-emerald-500/25"><Check size={13}/>Accept</button>
              <button onClick={() => reject(change.id)} className="inline-flex items-center gap-1 rounded bg-red-500/15 px-2 py-1 text-red-200 hover:bg-red-500/25"><X size={13}/>Reject</button>
            </div>
          </div>
          <pre className="scrollbar-thin max-h-72 overflow-auto p-3 text-xs leading-relaxed text-slate-300"><code>{change.diff}</code></pre>
        </article>
      ))}
    </div>
  );
}
