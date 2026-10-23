"use client";

import { useState } from "react";
import { api, type Project } from "@/lib/api";

export function AddProjectForm({ onCreated }: { onCreated: (project: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const project = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ owner, repo, githubToken, name: name || undefined }),
      });
      onCreated(project);
      setOpen(false);
      setOwner("");
      setRepo("");
      setGithubToken("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add project");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition shadow-lg shadow-sky-500/20"
      >
        + Add Project
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Connect GitHub Repository</h3>
            <p className="text-xs text-slate-400">Add repository for CI/CD tracking and webhook telemetry.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">Owner / Org</label>
            <input
              required
              placeholder="e.g. facebook"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">Repository</label>
            <input
              required
              placeholder="e.g. react"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">Display Name (Optional)</label>
            <input
              placeholder="e.g. Frontend Web App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-200 outline-none focus:border-sky-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold uppercase tracking-wider text-slate-400 mb-1">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              required
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-slate-200 outline-none focus:border-sky-500 font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              🔒 Token is encrypted at rest using AES-256-GCM and never transmitted to the browser.
            </p>
          </div>
        </div>

        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition shadow-lg shadow-sky-500/20"
          >
            {busy ? "Registering…" : "Connect Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
