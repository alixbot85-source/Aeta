"use client";
import { useState } from "react";
import { api, setToken } from "../lib/api";
import { useIDEStore } from "../store/ide-store";

export function LoginScreen({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("developer@example.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [name, setName] = useState("Developer");
  const [error, setError] = useState<string | null>(null);
  const store = useIDEStore();

  async function submit() {
    setError(null);
    try {
      const data = await api<{ token: string; user: { id: string; email: string; name?: string } }>(`/api/v1/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(mode === "register" ? { email, password, name } : { email, password })
      });
      setToken(data.token);
      store.set({ token: data.token, user: data.user });
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#172554,#070b12_45%)] p-6 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-950/80 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6">
          <div className="mb-2 inline-flex rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200">100% DeepSeek AI</div>
          <h1 className="text-3xl font-semibold">Aeta IDE</h1>
          <p className="mt-2 text-sm text-slate-400">A browser Web IDE with real workspace files, terminal, Git, Monaco, and a DeepSeek coding agent.</p>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-900 p-1 text-sm">
          <button className={`rounded-md px-3 py-2 ${mode === "login" ? "bg-slate-700" : "text-slate-400"}`} onClick={() => setMode("login")}>Login</button>
          <button className={`rounded-md px-3 py-2 ${mode === "register" ? "bg-slate-700" : "text-slate-400"}`} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" && <Field label="Name" value={name} onChange={setName} />}
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Password" value={password} onChange={setPassword} type="password" />
        {error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400" onClick={submit}>{mode === "login" ? "Login" : "Create account"}</button>
        <p className="mt-4 text-xs text-slate-500">Credentials are sent only to the Aeta backend. DeepSeek API keys never go to the browser.</p>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="mb-3 block text-sm"><span className="mb-1 block text-slate-400">{label}</span><input className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-cyan-500" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
