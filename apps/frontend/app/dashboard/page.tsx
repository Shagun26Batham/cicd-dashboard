"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AddProjectForm } from "@/components/AddProjectForm";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { api, type DashboardPayload, type Project } from "@/lib/api";
import { formatDuration, formatPct, formatTime, shortSha } from "@/lib/format";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<DashboardPayload>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onCreated(_project: Project) {
    load();
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">GitHub Actions across your registered repos.</p>
        </div>
        <AddProjectForm onCreated={onCreated} />
      </div>
      {error ? <p className="mb-4 text-rose-300">{error}</p> : null}
      {!data ? (
        <p className="text-slate-400">Loading summary…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Projects" value={String(data.projects)} />
            <SummaryCard label="Total builds" value={String(data.totalBuilds)} />
            <SummaryCard label="Success rate" value={formatPct(data.successRate)} />
            <SummaryCard label="Failed builds" value={String(data.failedBuilds)} />
          </div>
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
              Projects
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.projectList.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-xl border border-[#243049] bg-[#121b2d] p-4 hover:border-sky-500/40"
                >
                  <p className="font-medium">{project.name}</p>
                  <p className="font-mono text-xs text-slate-400">
                    {project.owner}/{project.repo}
                  </p>
                </Link>
              ))}
              {data.projectList.length === 0 ? (
                <p className="text-sm text-slate-400">No projects yet. Add one or run the seed script.</p>
              ) : null}
            </div>
          </section>
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
              Recent pipeline runs
            </h2>
            <div className="overflow-hidden rounded-xl border border-[#243049]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#121b2d] text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Commit</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRuns.map((run) => (
                    <tr key={run.id} className="border-t border-[#243049]">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <StatusIcon conclusion={run.conclusion} status={run.status} />
                          <StatusBadge conclusion={run.conclusion} status={run.status} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link className="hover:text-sky-300" href={`/projects/${run.projectId}/runs/${run.id}`}>
                          {run.project?.name ?? run.workflowName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{run.branch ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{shortSha(run.commitSha)}</td>
                      <td className="px-4 py-3">{formatDuration(run.durationMs)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatTime(run.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#243049] bg-[#121b2d] p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
