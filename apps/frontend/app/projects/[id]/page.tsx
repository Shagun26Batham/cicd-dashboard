"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AppShell } from "@/components/AppShell";
import { MetricsCharts } from "@/components/MetricsCharts";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { WebhookConfigModal } from "@/components/WebhookConfigModal";
import {
  api,
  type Deployment,
  type MetricsPayload,
  type PipelineRun,
  type Project,
} from "@/lib/api";
import { formatDuration, formatTime, shortSha } from "@/lib/format";

type Tab = "runs" | "deployments" | "analytics" | "activity";

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
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

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
    setSyncSuccess(null);
    try {
      const res = await api<{ synced: number; totalCount: number }>(`/api/projects/${id}/sync`, {
        method: "POST",
        body: JSON.stringify({ includeJobs: true, maxRuns: 20 }),
      });
      setSyncSuccess(`Successfully synced ${res.synced} workflow runs from GitHub!`);
      await load();
      setTimeout(() => setSyncSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-300 transition mb-2"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {project?.name ?? "Project Details"}
            </h1>
            {project?.hasWebhookSecret ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Webhook Active
              </span>
            ) : null}
          </div>
          <p className="font-mono text-sm text-slate-400 mt-1">
            {project ? `${project.owner}/${project.repo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowWebhookModal(true)}
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            ⚡ Webhook Setup
          </button>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 transition shadow-lg shadow-sky-500/20"
          >
            {syncing ? "Syncing from GitHub…" : "Sync from GitHub"}
          </button>
        </div>
      </div>

      {syncSuccess ? (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
          {syncSuccess}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex gap-2 border-b border-slate-800 pb-3">
        {(["runs", "deployments", "analytics", "activity"] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold capitalize transition ${
              tab === item
                ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800/80"
            }`}
          >
            {item}
            {item === "runs" ? ` (${runs.length})` : item === "deployments" ? ` (${deployments.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "runs" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Commit</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {runs.map((run) => (
                  <tr key={run.id} className="transition hover:bg-slate-800/30">
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <StatusIcon conclusion={run.conclusion} status={run.status} />
                        <StatusBadge conclusion={run.conclusion} status={run.status} />
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        className="font-semibold text-slate-200 hover:text-sky-300 transition"
                        href={`/projects/${id}/runs/${run.id}`}
                      >
                        {run.workflowName ?? "workflow"}
                      </Link>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{run.commitMessage}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300">{run.branch ?? "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{shortSha(run.commitSha)}</td>
                    <td className="px-4 py-3.5 text-slate-300">{formatDuration(run.durationMs)}</td>
                    <td className="px-4 py-3.5 text-slate-500">{formatTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {runs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No workflow runs stored yet. Click &quot;Sync from GitHub&quot; or trigger a webhook.
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "deployments" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Commit</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {deployments.map((dep) => (
                  <tr key={dep.id} className="transition hover:bg-slate-800/30">
                    <td className="px-4 py-3.5 font-medium text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-violet-400" />
                        {dep.environment}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge conclusion={dep.status} />
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{shortSha(dep.commitSha)}</td>
                    <td className="px-4 py-3.5 text-slate-500">{formatTime(dep.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deployments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No deployments recorded yet. Deployments are automatically logged when jobs matching &quot;deploy&quot; complete.
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "analytics" && metrics ? <MetricsCharts metrics={metrics} /> : null}

      {tab === "activity" ? (
        <div className="max-w-2xl">
          <ActivityFeed projectId={project?.id} />
        </div>
      ) : null}

      {project ? (
        <WebhookConfigModal
          project={project}
          isOpen={showWebhookModal}
          onClose={() => setShowWebhookModal(false)}
          onUpdated={load}
        />
      ) : null}
    </AppShell>
  );
}
