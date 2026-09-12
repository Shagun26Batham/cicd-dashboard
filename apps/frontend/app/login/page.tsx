"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, type User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@local.test");
  const [password, setPassword] = useState("changeme");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<User>(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-[#243049] bg-[#121b2d] p-8"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Pipeline Hub</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Single-role access via httpOnly JWT cookie.</p>
        </div>
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          disabled={busy}
          className="w-full rounded-md bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="w-full text-sm text-slate-400 hover:text-white"
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
