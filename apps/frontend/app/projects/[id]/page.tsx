"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricsCharts } from "@/components/MetricsCharts";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import {
  api,
  type Deployment,
  type MetricsPayload,
  type PipelineRun,
  type Project,
} from "@/lib/api";
import { formatDuration, formatTime, shortSha } from "@/lib/format";

type Tab = "runs" | "deployments" | "analytics";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>("runs");
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r, d, m] = await Promise.all([
        api<Project>(`/api/projects/${id}`),
        api<PipelineRun[]>(`/api/projects/${id}/runs`),
        api<Deployment[]>(`/api/projects/${id}/deployments`),
        api<MetricsPayload>(`/api/metrics/${id}`),
      ]);
      setProject(p);
      setRuns(r);
      setDeployments(d);
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      await api(`/api/projects/${id}/sync`, {
        method: "POST",
        body: JSON.stringify({ includeJobs: true, maxRuns: 20 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{project?.name ?? "Project"}</h1>
          <p className="font-mono text-sm text-slate-400">
            {project ? `${project.owner}/${project.repo}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="rounded-md border border-[#243049] px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync from GitHub"}
        </button>
      </div>
      {error ? <p className="mb-4 text-sm text-rose-300">{error}</p> : null}
      <div className="mb-6 flex gap-2">
        {(["runs", "deployments", "analytics"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-3 py-1.5 text-sm capitalize ${
              tab === item ? "bg-sky-500 text-slate-950" : "bg-white/5 text-slate-300"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "runs" ? (
        <div className="overflow-hidden rounded-xl border border-[#243049]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#121b2d] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-[#243049]">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <StatusIcon conclusion={run.conclusion} status={run.status} />
                      <StatusBadge conclusion={run.conclusion} status={run.status} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link className="hover:text-sky-300" href={`/projects/${id}/runs/${run.id}`}>
                      {run.workflowName ?? "workflow"}
                    </Link>
                    <p className="text-xs text-slate-400">{run.commitMessage}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{run.branch ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{shortSha(run.commitSha)}</td>
                  <td className="px-4 py-3">{formatDuration(run.durationMs)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatTime(run.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {runs.length === 0 ? <p className="p-4 text-sm text-slate-400">No runs stored yet.</p> : null}
        </div>
      ) : null}

      {tab === "deployments" ? (
        <div className="overflow-hidden rounded-xl border border-[#243049]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#121b2d] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((dep) => (
                <tr key={dep.id} className="border-t border-[#243049]">
                  <td className="px-4 py-3">{dep.environment}</td>
                  <td className="px-4 py-3">
                    <StatusBadge conclusion={dep.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{shortSha(dep.commitSha)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatTime(dep.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {deployments.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No deployments recorded yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "analytics" && metrics ? <MetricsCharts metrics={metrics} /> : null}
    </AppShell>
  );
}
