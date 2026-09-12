"use client";

import { statusTone } from "@/lib/format";

const styles = {
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  fail: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  run: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  skip: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  muted: "bg-white/5 text-slate-400 ring-white/10",
};

export function StatusBadge({
  conclusion,
  status,
}: {
  conclusion?: string | null;
  status?: string | null;
}) {
  const tone = statusTone(conclusion, status ?? undefined);
  const label = (conclusion || status || "unknown").replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${styles[tone]}`}
    >
      {label}
    </span>
  );
}
