"use client";

import type { PipelineJob } from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/format";
import { StatusIcon } from "./StatusIcon";

const CANONICAL_STAGES = ["checkout", "install", "test", "build", "deploy"];

export function PipelineViz({ jobs }: { jobs: PipelineJob[] }) {
  const steps = jobs.flatMap((job) =>
    job.steps.map((step) => ({ ...step, jobName: job.name })),
  );

  const ordered =
    steps.length > 0
      ? steps
      : CANONICAL_STAGES.map((name, index) => ({
          id: name,
          number: index + 1,
          name,
          status: "queued",
          conclusion: null,
          startedAt: null,
          completedAt: null,
          jobName: "pipeline",
        }));

  const failedStep = ordered.find((s) => s.conclusion === "failure");

  // Determine status for high-level canonical stages
  const stageStatuses = CANONICAL_STAGES.map((stageName) => {
    const matching = ordered.find((s) =>
      s.name.toLowerCase().includes(stageName.toLowerCase()),
    );
    if (!matching) {
      return { stage: stageName, status: "pending", conclusion: null };
    }
    return {
      stage: stageName,
      status: matching.status,
      conclusion: matching.conclusion,
      duration:
        matching.startedAt && matching.completedAt
          ? new Date(matching.completedAt).getTime() - new Date(matching.startedAt).getTime()
          : null,
    };
  });

  return (
    <div className="space-y-8">
      {/* High-level stage graph */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-sm shadow-xl shadow-black/20">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Pipeline Workflow Stages
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {stageStatuses.map((stage, idx) => {
            const isFailed = stage.conclusion === "failure";
            const isSuccess = stage.conclusion === "success";
            const isRunning = stage.status === "in_progress";

            return (
              <div key={stage.stage} className="flex items-center flex-1 min-w-[120px]">
                <div
                  className={`flex-1 rounded-xl border p-3 transition ${
                    isFailed
                      ? "border-rose-500/50 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                      : isSuccess
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : isRunning
                      ? "border-sky-500/50 bg-sky-500/10 animate-pulse"
                      : "border-slate-800 bg-slate-950/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                      {stage.stage}
                    </span>
                    <StatusIcon conclusion={stage.conclusion} status={stage.status} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {isFailed ? "Failed" : isSuccess ? "Passed" : isRunning ? "Running…" : "Skipped / Pending"}
                  </p>
                </div>
                {idx < stageStatuses.length - 1 ? (
                  <div className="hidden sm:block px-1 text-slate-600 font-bold">→</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {failedStep ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4.5 backdrop-blur-sm text-xs text-rose-200 flex items-start gap-3">
          <span className="text-rose-400 text-lg">⚠️</span>
          <div>
            <h4 className="font-bold text-rose-300">Pipeline Failure Detected</h4>
            <p className="mt-0.5 text-rose-300/80">
              Pipeline failed at step <strong className="font-mono text-white underline">{failedStep.name}</strong>{" "}
              in job <strong className="text-white">{failedStep.jobName}</strong>. All subsequent deployment stages were halted.
            </p>
          </div>
        </div>
      ) : null}

      {/* Step by step execution trace */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Execution Step Trace ({ordered.length} steps)
        </h3>
        <ol className="space-y-0">
          {ordered.map((step, index) => {
            const failedHere = failedStep?.id === step.id;
            const duration =
              step.startedAt && step.completedAt
                ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
                : null;

            return (
              <li key={step.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StatusIcon conclusion={step.conclusion} status={step.status} />
                  {index < ordered.length - 1 ? (
                    <span className="my-1.5 w-px flex-1 bg-slate-800" />
                  ) : null}
                </div>
                <div
                  className={`mb-3.5 flex-1 rounded-xl border p-4 transition ${
                    failedHere
                      ? "border-rose-500/50 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                      : "border-slate-800/80 bg-slate-900/50 backdrop-blur-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-200">
                      {step.name}
                      <span className="ml-2 rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        {step.jobName}
                      </span>
                    </p>
                    <span className="font-mono text-xs text-slate-400">{formatDuration(duration)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatTime(step.startedAt)}
                    {failedHere ? (
                      <span className="ml-2 font-semibold text-rose-400">· Failed at this step</span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
