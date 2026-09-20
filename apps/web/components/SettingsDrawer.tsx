"use client";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<{ ai?: Record<string, unknown>; settings?: Record<string, unknown> }>({});
  useEffect(() => { if (open) void api<{ settings: Record<string, unknown>; ai: Record<string, unknown> }>("/api/v1/settings").then(setSettings).catch(() => undefined); }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/50"><aside className="h-full w-full max-w-xl overflow-auto border-l border-slate-800 bg-chrome-950 p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Settings</h2><button onClick={onClose} className="rounded p-1 hover:bg-slate-800"><X size={18}/></button></div><div className="grid gap-3">{["General", "Editor", "Appearance", "Keyboard Shortcuts", "AI", "Models", "API Keys", "Terminal", "Git", "Security", "Account", "Billing"].map((section) => <section key={section} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><h3 className="mb-2 font-medium text-cyan-100">{section}</h3>{section === "AI" ? <AISettings ai={settings.ai ?? {}} /> : <p className="text-sm text-slate-400">Server-backed settings category. Values are persisted through <code>/api/v1/settings</code>.</p>}</section>)}</div></aside></div>;
}

function AISettings({ ai }: { ai: Record<string, unknown> }) {
  return <dl className="grid grid-cols-2 gap-2 text-sm"><dt className="text-slate-400">AI Provider</dt><dd>DeepSeek</dd><dt className="text-slate-400">Model</dt><dd>{String(ai.model ?? "configured by server")}</dd><dt className="text-slate-400">Base URL</dt><dd>{String(ai.baseUrl ?? "server env")}</dd><dt className="text-slate-400">API Key</dt><dd>{ai.configured ? "Configured on backend" : "Missing DEEPSEEK_API_KEY"}</dd><dt className="text-slate-400">Streaming</dt><dd>{ai.streaming ? "ON" : "OFF"}</dd><dt className="text-slate-400">Temperature / Max Tokens</dt><dd>Supported when backend sends those DeepSeek parameters</dd></dl>;
}
