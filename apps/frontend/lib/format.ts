export function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function shortSha(sha: string | null | undefined) {
  if (!sha) return "—";
  return sha.slice(0, 7);
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}

export function statusTone(conclusion: string | null | undefined, status?: string) {
  const value = (conclusion || status || "").toLowerCase();
  if (value === "success" || value === "completed") {
    return "ok" as const;
  }
  if (value === "failure" || value === "failed" || value === "timed_out") {
    return "fail" as const;
  }
  if (value === "in_progress" || value === "queued" || value === "pending") {
    return "run" as const;
  }
  if (value === "skipped" || value === "cancelled" || value === "canceled") {
    return "skip" as const;
  }
  return "muted" as const;
}
