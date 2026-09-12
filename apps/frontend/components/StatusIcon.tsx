"use client";

import { statusTone } from "@/lib/format";

export function StatusIcon({
  conclusion,
  status,
}: {
  conclusion?: string | null;
  status?: string | null;
}) {
  const tone = statusTone(conclusion, status ?? undefined);
  const cls = {
    ok: "text-emerald-400",
    fail: "text-rose-400",
    run: "text-sky-400 animate-pulse",
    skip: "text-slate-500",
    muted: "text-slate-500",
  }[tone];

  if (tone === "ok") {
    return (
      <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L9 10.94 7.28 9.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (tone === "fail") {
    return (
      <svg className={`h-5 w-5 ${cls}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center ${cls}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  );
}
