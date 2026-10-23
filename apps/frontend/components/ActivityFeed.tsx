"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { api, type PipelineEvent } from "@/lib/api";
import { formatTime, shortSha } from "@/lib/format";

interface ActivityFeedProps {
  projectId?: string;
  onEventReceived?: (event: PipelineEvent) => void;
  maxEvents?: number;
}

export function ActivityFeed({ projectId, onEventReceived, maxEvents = 15 }: ActivityFeedProps) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [filter, setFilter] = useState<"all" | "workflow_run" | "workflow_job">("all");

  useEffect(() => {
    let source: EventSource | null = null;
    let pollFallback: NodeJS.Timeout | null = null;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    function fetchHistoricalRecent() {
      api<{ events: PipelineEvent[] }>("/api/events/recent?limit=10")
        .then((res) => {
          if (res.events && res.events.length > 0) {
            setEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const fresh = res.events.filter((e) => !existingIds.has(e.id));
              return [...prev, ...fresh].slice(0, maxEvents);
            });
          } else {
            // Fallback: seed with recent runs from dashboard so it's NEVER blank
            api<{ recentRuns: Array<{ id: string; workflowName: string; branch: string; commitSha: string; conclusion: string; status: string; startedAt: string; project?: { id: string; name: string } }> }>("/api/dashboard")
              .then((dash) => {
                if (dash.recentRuns?.length) {
                  const seeded: PipelineEvent[] = dash.recentRuns.slice(0, 5).map((r) => ({
                    id: `seed-${r.id}`,
                    type: "workflow_run",
                    action: "completed",
                    projectId: r.project?.id,
                    projectName: r.project?.name || "Pipeline",
                    runId: r.id,
                    workflowName: r.workflowName,
                    status: r.status,
                    conclusion: r.conclusion,
                    branch: r.branch,
                    commitSha: r.commitSha,
                    title: `Workflow "${r.workflowName || 'CI'}" ${r.conclusion || r.status}`,
                    timestamp: r.startedAt || new Date().toISOString(),
                  }));
                  setEvents((prev) => (prev.length === 0 ? seeded : prev));
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    // Immediately seed with historical events on mount
    fetchHistoricalRecent();

    try {
      source = new EventSource(`${apiBase}/api/events`, {
        withCredentials: true,
      });

      source.onopen = () => {
        setConnected(true);
      };

      const handleIncoming = (rawEventData: string) => {
        try {
          const payload = JSON.parse(rawEventData);
          if (payload.type === "handshake" && Array.isArray(payload.events)) {
            setEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const fresh = payload.events.filter((e: PipelineEvent) => !existingIds.has(e.id));
              return [...fresh, ...prev].slice(0, maxEvents);
            });
          } else if (payload.id) {
            const incoming = payload as PipelineEvent;
            setEvents((prev) => [incoming, ...prev.filter((e) => e.id !== incoming.id)].slice(0, maxEvents));
            onEventReceived?.(incoming);
          }
        } catch {
          // ignore heartbeats
        }
      };

      source.onmessage = (message) => handleIncoming(message.data);

      // Named SSE events
      source.addEventListener("run.updated", (e: MessageEvent) => handleIncoming(e.data));
      source.addEventListener("run.completed", (e: MessageEvent) => handleIncoming(e.data));
      source.addEventListener("job.updated", (e: MessageEvent) => handleIncoming(e.data));
      source.addEventListener("deployment.created", (e: MessageEvent) => handleIncoming(e.data));

      source.onerror = () => {
        setConnected(false);
        if (!pollFallback) {
          fetchHistoricalRecent();
          pollFallback = setInterval(fetchHistoricalRecent, 5000);
        }
      };
    } catch {
      fetchHistoricalRecent();
      pollFallback = setInterval(fetchHistoricalRecent, 5000);
    }

    return () => {
      source?.close();
      if (pollFallback) clearInterval(pollFallback);
    };
  }, [maxEvents, onEventReceived]);

  async function triggerTestEvent() {
    setSimulating(true);
    try {
      const targetId = projectId || "any";
      await api(`/api/projects/${targetId}/test-event`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.error("Test event simulation failed", err);
    } finally {
      setSimulating(false);
    }
  }

  const displayedEvents = events
    .filter((e) => (!projectId || e.projectId === projectId || e.projectId === "demo"))
    .filter((e) => (filter === "all" ? true : e.type === filter));

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className={`relative inline-flex h-3 w-3 rounded-full ${connected ? "bg-emerald-500" : "bg-sky-400"}`} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Live Activity Feed
              <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Listening for events
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {connected ? "Real-time SSE webhook ingress active" : "Connected (polling fallback active)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-950/60 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded px-2 py-0.5 transition ${
                filter === "all" ? "bg-sky-500 text-slate-950 font-medium" : "text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("workflow_run")}
              className={`rounded px-2 py-0.5 transition ${
                filter === "workflow_run" ? "bg-sky-500 text-slate-950 font-medium" : "text-slate-400 hover:text-white"
              }`}
            >
              Runs
            </button>
            <button
              type="button"
              onClick={() => setFilter("workflow_job")}
              className={`rounded px-2 py-0.5 transition ${
                filter === "workflow_job" ? "bg-sky-500 text-slate-950 font-medium" : "text-slate-400 hover:text-white"
              }`}
            >
              Jobs
            </button>
          </div>
          <button
            type="button"
            onClick={triggerTestEvent}
            disabled={simulating}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition"
            title="Fire a synthetic GitHub event through the pipeline to test real-time reactivity"
          >
            {simulating ? "Triggering…" : "⚡ Test Event"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
        {displayedEvents.map((event) => {
          const isRun = event.type === "workflow_run";
          return (
            <div
              key={event.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 text-xs transition hover:border-slate-700 hover:bg-slate-900/40"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 shrink-0">
                  <StatusIcon conclusion={event.conclusion} status={event.status || "completed"} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 truncate">
                      {event.projectName || (isRun ? "Workflow Run" : "Job")}
                    </span>
                    <StatusBadge conclusion={event.conclusion} status={event.status} />
                  </div>
                  <p className="mt-0.5 text-slate-400 truncate">{event.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                    {event.branch ? <span>{event.branch}</span> : null}
                    {event.commitSha ? <span>{shortSha(event.commitSha)}</span> : null}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[11px] text-slate-500">{formatTime(event.timestamp)}</span>
                {event.projectId && event.runId && event.projectId !== "demo" ? (
                  <div className="mt-1">
                    <Link
                      href={`/projects/${event.projectId}/runs/${event.runId}`}
                      className="text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      View run →
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {displayedEvents.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-xs text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            <span>Listening for live GitHub events…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
