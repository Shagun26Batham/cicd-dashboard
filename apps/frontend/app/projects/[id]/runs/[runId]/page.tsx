"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PipelineViz } from "@/components/PipelineViz";
import { StatusBadge } from "@/components/StatusBadge";
import { api, type RunDetail } from "@/lib/api";
import { formatDuration, formatTime, shortSha } from "@/lib/format";

export default function RunPage() {
  const params = useParams<{ id: string; runId: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<RunDetail>(`/api/projects/${params.id}/runs/${params.runId}`)
      .then(setRun)
      .catch((err) => setError(err.message));
  }, [params.id, params.runId]);

  return (
    <AppShell>
      <Link href={`/projects/${params.id}`} className="text-xs text-slate-400 hover:text-white">
        ← Build history
      </Link>
      {error ? <p className="mt-4 text-rose-300">{error}</p> : null}
      {!run ? (
        <p className="mt-6 text-slate-400">Loading pipeline…</p>
      ) : (
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            <h1 className="text-2xl font-semibold">{run.workflowName ?? "Pipeline run"}</h1>
            <p className="mt-1 text-sm text-slate-400">{run.commitMessage}</p>
            <div className="mt-8">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-400">
                Steps
              </h2>
              <PipelineViz jobs={run.jobs} />
            </div>
          </div>
          <aside className="space-y-3 rounded-xl border border-[#243049] bg-[#121b2d] p-4 text-sm">
            <StatusBadge conclusion={run.conclusion} status={run.status} />
            <Row label="Branch" value={run.branch ?? "—"} mono />
            <Row label="Commit" value={shortSha(run.commitSha)} mono />
            <Row label="Duration" value={formatDuration(run.durationMs)} />
            <Row label="Started" value={formatTime(run.startedAt)} />
            {run.htmlUrl ? (
              <a className="inline-block text-sky-300 hover:underline" href={run.htmlUrl} target="_blank">
                View on GitHub
              </a>
            ) : null}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={mono ? "font-mono" : ""}>{value}</p>
    </div>
  );
}
