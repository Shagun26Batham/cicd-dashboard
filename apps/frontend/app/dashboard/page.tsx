"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AddProjectForm } from "@/components/AddProjectForm";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { api, type DashboardPayload, type PipelineEvent, type Project } from "@/lib/api";
import { formatDuration, formatPct, formatTime, shortSha } from "@/lib/format";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setRefreshing(true);
    api<DashboardPayload>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onCreated(_project: Project) {
    load();
  }

  const handleLiveEvent = useCallback(
    (_event: PipelineEvent) => {
      // Re-fetch dashboard stats silently when a live event completes
      load(true);
    },
    [load],
  );

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">CI/CD Pipeline Monitor</h1>
            {refreshing ? (
              <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400 font-medium animate-pulse">
                Refreshing…
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Centralized telemetry, builds, and automated deployments across GitHub repositories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => load()}
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            ↻ Refresh
          </button>
          <AddProjectForm onCreated={onCreated} />
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Connected Projects"
              value={String(data.projects)}
              subtext="Monitored repositories"
              accent="sky"
            />
            <SummaryCard
              label="Total Pipeline Runs"
              value={String(data.totalBuilds)}
              subtext="All historical workflows"
              accent="indigo"
            />
            <SummaryCard
              label="Global Success Rate"
              value={formatPct(data.successRate)}
              subtext={`${data.successfulBuilds} passing runs`}
              accent="emerald"
            />
            <SummaryCard
              label="Failed Builds"
              value={String(data.failedBuilds)}
              subtext="Requires developer attention"
              accent={data.failedBuilds > 0 ? "rose" : "slate"}
            />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Monitored Projects
                  </h2>
                  <span className="text-xs text-slate-500">{data.projectList.length} total</span>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {data.projectList.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-sm transition-all duration-200 hover:border-sky-500/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-sky-500/5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-100 group-hover:text-sky-300 transition">
                            {project.name}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-400">
                            {project.owner}/{project.repo}
                          </p>
                        </div>
                        <span className="text-slate-600 group-hover:text-sky-400 transition text-sm">
                          →
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Added {formatTime(project.createdAt)}</span>
                      </div>
                    </Link>
                  ))}
                  {data.projectList.length === 0 ? (
                    <div className="col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                      No projects registered yet. Click &quot;Add Project&quot; above to connect a GitHub repository.
                    </div>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recent Pipeline Runs
                  </h2>
                  <span className="text-xs text-slate-500">Latest 15 runs</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm shadow-xl shadow-black/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Workflow / Project</th>
                          <th className="px-4 py-3">Branch</th>
                          <th className="px-4 py-3">Commit</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Started</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {data.recentRuns.map((run) => (
                          <tr
                            key={run.id}
                            className="transition hover:bg-slate-800/30"
                          >
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-2">
                                <StatusIcon conclusion={run.conclusion} status={run.status} />
                                <StatusBadge conclusion={run.conclusion} status={run.status} />
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <Link
                                className="font-medium text-slate-200 hover:text-sky-300 transition"
                                href={`/projects/${run.projectId}/runs/${run.id}`}
                              >
                                {run.workflowName || run.project?.name || "Pipeline"}
                              </Link>
                              {run.project ? (
                                <p className="text-[11px] text-slate-500">{run.project.name}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300">
                              {run.branch ?? "—"}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                              {shortSha(run.commitSha)}
                            </td>
                            <td className="px-4 py-3.5 text-slate-300">
                              {formatDuration(run.durationMs)}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {formatTime(run.startedAt)}
                            </td>
                          </tr>
                        ))}
                        {data.recentRuns.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                              No pipeline runs recorded yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <ActivityFeed onEventReceived={handleLiveEvent} />
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string;
  subtext: string;
  accent: "sky" | "indigo" | "emerald" | "rose" | "slate";
}) {
  const accentStyles = {
    sky: "border-sky-500/20 bg-sky-500/5 text-sky-400",
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-400",
    slate: "border-slate-800 bg-slate-900/40 text-slate-400",
  }[accent];

  return (
    <div
      className={`rounded-2xl border p-5 backdrop-blur-md transition hover:border-slate-700 bg-slate-900/60 ${accentStyles}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtext}</p>
    </div>
  );
}
