"use client";

import { useState } from "react";
import { api, type Project } from "@/lib/api";

interface WebhookConfigModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function WebhookConfigModal({ project, isOpen, onClose, onUpdated }: WebhookConfigModalProps) {
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const backendHost =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`)
      : "http://localhost:4000";

  const webhookUrl = `${backendHost}/api/webhooks/github/${project.id}`;

  async function rotateSecret() {
    setRotating(true);
    try {
      const res = await api<{ webhookSecret: string }>(`/api/projects/${project.id}/webhook-secret`, {
        method: "POST",
      });
      setSecret(res.webhookSecret);
      onUpdated?.();
    } catch (err) {
      console.error("Failed to rotate webhook secret", err);
    } finally {
      setRotating(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Connect Webhook</h3>
            <p className="text-xs text-slate-400">
              Receive real-time <code className="text-sky-300">workflow_run</code> and <code className="text-sky-300">workflow_job</code> events without polling.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Payload URL</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={webhookUrl}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-slate-200"
              />
              <button
                type="button"
                onClick={() => copy(webhookUrl, "url")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-medium text-slate-200 hover:bg-slate-700"
              >
                {copied === "url" ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              For local testing with real GitHub repos, expose port 4000 via ngrok:{" "}
              <code className="text-slate-300">ngrok http 4000</code> and use that domain.
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Content type</label>
            <input
              readOnly
              value="application/json"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-slate-200"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-300">Webhook Secret (HMAC SHA-256)</label>
              <button
                type="button"
                disabled={rotating}
                onClick={rotateSecret}
                className="text-sky-400 hover:text-sky-300 text-[11px] font-medium"
              >
                {rotating ? "Generating…" : secret ? "Regenerate" : "Generate / Reveal"}
              </button>
            </div>
            {secret ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={secret}
                  className="w-full rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2 font-mono text-emerald-300"
                />
                <button
                  type="button"
                  onClick={() => copy(secret, "secret")}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-medium text-slate-200 hover:bg-slate-700"
                >
                  {copied === "secret" ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3 text-slate-400">
                {project.hasWebhookSecret
                  ? "A secret is active on this project. Click 'Regenerate' to generate a new secret."
                  : "No secret generated yet. Click 'Generate' to create an HMAC secret."}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-sky-950/60 bg-sky-950/20 p-3.5 text-slate-300">
            <h4 className="font-semibold text-sky-300 mb-1">GitHub Configuration Steps:</h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              <li>Open GitHub repository &gt; <strong className="text-slate-200">Settings</strong> &gt; <strong className="text-slate-200">Webhooks</strong> &gt; <strong className="text-slate-200">Add webhook</strong>.</li>
              <li>Paste the <strong className="text-slate-200">Payload URL</strong> and select <strong className="text-slate-200">application/json</strong>.</li>
              <li>Paste the <strong className="text-slate-200">Secret</strong> from above into GitHub.</li>
              <li>Under &quot;Which events would you like to trigger this webhook?&quot;, select <strong className="text-slate-200">Let me select individual events</strong>.</li>
              <li>Check <strong className="text-sky-300">Workflow jobs</strong> and <strong className="text-sky-300">Workflow runs</strong>.</li>
              <li>Save webhook. GitHub will ping the dashboard immediately!</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
