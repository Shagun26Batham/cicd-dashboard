"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Project, type Workflow, type WorkflowYamlDetail } from "@/lib/api";
import { formatTime } from "@/lib/format";

interface WorkflowViewerProps {
  project: Project;
}

export function WorkflowViewer({ project }: WorkflowViewerProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | number | null>(null);
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowYamlDetail | null>(null);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);
  const [loadingYaml, setLoadingYaml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch list of workflows for the project
  const loadWorkflows = useCallback(async () => {
    setLoadingWorkflows(true);
    setError(null);
    try {
      const data = await api<{ total_count: number; workflows: Workflow[] }>(
        `/api/projects/${project.id}/workflows`,
      );
      const list = data.workflows || [];
      setWorkflows(list);
      if (list.length > 0) {
        setSelectedWorkflowId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoadingWorkflows(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Fetch YAML content when selected workflow changes
  const loadYaml = useCallback(
    async (workflowId: string | number) => {
      setLoadingYaml(true);
      setError(null);
      try {
        const detail = await api<WorkflowYamlDetail>(
          `/api/projects/${project.id}/workflows/${encodeURIComponent(workflowId)}`,
        );
        setWorkflowDetail(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflow YAML");
      } finally {
        setLoadingYaml(false);
      }
    },
    [project.id],
  );

  useEffect(() => {
    if (selectedWorkflowId != null) {
      loadYaml(selectedWorkflowId);
    }
  }, [selectedWorkflowId, loadYaml]);

  const handleCopy = () => {
    if (!workflowDetail?.content) return;
    navigator.clipboard.writeText(workflowDetail.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingWorkflows) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-800/60" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/50" />
      </div>
    );
  }

  if (error && workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-rose-300">Unable to load GitHub Actions workflows</p>
        <p className="mt-1 text-xs text-rose-300/80">{error}</p>
        <button
          type="button"
          onClick={loadWorkflows}
          className="mt-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
        <p className="text-sm font-semibold text-slate-300">No GitHub Actions workflows found</p>
        <p className="mt-1 text-xs text-slate-500">
          Make sure your repository has workflow files located in the{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sky-400">
            .github/workflows
          </code>{" "}
          directory.
        </p>
      </div>
    );
  }

  const lines = workflowDetail?.content ? workflowDetail.content.split("\n") : [];

  return (
    <div className="space-y-4">
      {/* Top Controls: Selector, Metadata, and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="workflow-select" className="text-xs font-medium text-slate-400">
            Workflow:
          </label>
          <select
            id="workflow-select"
            value={selectedWorkflowId ?? ""}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 outline-none focus:border-sky-500"
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name} ({wf.path.split("/").pop()})
              </option>
            ))}
          </select>

          {workflowDetail?.workflow && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="hidden sm:inline text-slate-600">•</span>
              <span className="font-mono text-slate-300">{workflowDetail.workflow.path}</span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                {workflowDetail.workflow.state}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {workflowDetail?.workflow.htmlUrl && (
            <a
              href={workflowDetail.workflow.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              View on GitHub ↗
            </a>
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!workflowDetail?.content || loadingYaml}
            className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition shadow-md shadow-sky-500/20"
          >
            {copied ? "Copied!" : "Copy YAML"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* YAML Content Area */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span className="font-mono text-slate-300">
              {workflowDetail?.workflow.path || "workflow.yml"}
            </span>
            {workflowDetail?.size ? (
              <span className="text-slate-500">({(workflowDetail.size / 1024).toFixed(1)} KB)</span>
            ) : null}
          </div>
          {workflowDetail?.workflow.updatedAt && (
            <span className="text-[11px] text-slate-500">
              Updated {formatTime(workflowDetail.workflow.updatedAt)}
            </span>
          )}
        </div>

        {loadingYaml ? (
          <div className="flex h-96 items-center justify-center text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
              <span>Fetching workflow YAML from GitHub…</span>
            </div>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-auto p-4 font-mono text-xs leading-relaxed">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="w-12 select-none pr-4 text-right text-slate-600 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="whitespace-pre text-slate-200">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
