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
        className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
      >
        Add project
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-[#243049] bg-[#121b2d] p-4 sm:grid-cols-2">
      <input
        required
        placeholder="GitHub owner"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="Repository"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        className="rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2 text-sm"
      />
      <input
        placeholder="Display name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2 text-sm"
      />
      <input
        required
        type="password"
        placeholder="GitHub token (stored server-side)"
        value={githubToken}
        onChange={(e) => setGithubToken(e.target.value)}
        className="rounded-md border border-[#243049] bg-[#0b1220] px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          disabled={busy}
          className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save project"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
