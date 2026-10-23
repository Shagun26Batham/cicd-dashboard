"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PipelineViz } from "@/components/PipelineViz";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
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
      <Link
        href={`/projects/${params.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-300 transition mb-4"
      >
        ← Back to Build History
      </Link>
      {error ? <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div> : null}
      {!run ? (
        <div className="flex items-center gap-3 text-sm text-slate-400 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <span>Loading pipeline run details…</span>
        </div>
      ) : (
        <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex items-center gap-3">
              <StatusIcon conclusion={run.conclusion} status={run.status} />
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {run.workflowName ?? "Pipeline Run"}
              </h1>
            </div>
            <p className="mt-2 text-sm text-slate-400">{run.commitMessage || "No commit message"}</p>

            <div className="mt-8">
              <PipelineViz jobs={run.jobs} />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl shadow-black/20 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">Run Status</span>
                <StatusBadge conclusion={run.conclusion} status={run.status} />
              </div>
              <Row label="Branch" value={run.branch ?? "—"} mono />
              <Row label="Commit SHA" value={shortSha(run.commitSha)} mono />
              <Row label="Build Duration" value={formatDuration(run.durationMs)} />
              <Row label="Started At" value={formatTime(run.startedAt)} />
              <Row label="Completed At" value={formatTime(run.completedAt)} />
              {run.htmlUrl ? (
                <div className="pt-2 border-t border-slate-800">
                  <a
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 py-2 font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition text-xs"
                    href={run.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on GitHub ↗
                  </a>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
      <p className={`mt-0.5 text-slate-200 font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
