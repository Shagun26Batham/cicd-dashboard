"use client";

import type { PipelineJob } from "@/lib/api";
import { formatDuration, formatTime } from "@/lib/format";
import { StatusIcon } from "./StatusIcon";

const CANONICAL = ["checkout", "install", "test", "build", "deploy"];

export function PipelineViz({ jobs }: { jobs: PipelineJob[] }) {
  const steps = jobs.flatMap((job) =>
    job.steps.map((step) => ({ ...step, jobName: job.name })),
  );
  const ordered =
    steps.length > 0
      ? steps
      : CANONICAL.map((name, index) => ({
          id: name,
          number: index + 1,
          name,
          status: "queued",
          conclusion: null,
          startedAt: null,
          completedAt: null,
          jobName: "pipeline",
        }));

  const failed = ordered.find((s) => s.conclusion === "failure");

  return (
    <ol className="space-y-0">
      {ordered.map((step, index) => {
        const failedHere = failed?.id === step.id;
        const duration =
          step.startedAt && step.completedAt
            ? new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()
            : null;
        return (
          <li key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StatusIcon conclusion={step.conclusion} status={step.status} />
              {index < ordered.length - 1 ? (
                <span className="my-1 w-px flex-1 bg-[#243049]" />
              ) : null}
            </div>
            <div
              className={`mb-4 flex-1 rounded-xl border p-4 ${
                failedHere
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-[#243049] bg-[#121b2d]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium capitalize">
                  {step.name}
                  <span className="ml-2 text-xs font-normal text-slate-400">{step.jobName}</span>
                </p>
                <span className="text-xs text-slate-400">{formatDuration(duration)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatTime(step.startedAt)}
                {failedHere ? " · failed here" : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
