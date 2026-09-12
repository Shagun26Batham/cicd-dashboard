const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || res.statusText, res.status);
  }
  return data as T;
}

export type User = { id: string; email: string; role: string };
export type Project = {
  id: string;
  name: string;
  owner: string;
  repo: string;
  createdAt: string;
};
export type PipelineRun = {
  id: string;
  githubRunId: string;
  projectId: string;
  workflowName: string | null;
  status: string;
  conclusion: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMessage: string | null;
  htmlUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  project?: { id: string; name: string; owner: string; repo: string };
};
export type PipelineStep = {
  id: string;
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
};
export type PipelineJob = {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: PipelineStep[];
};
export type RunDetail = PipelineRun & { jobs: PipelineJob[] };
export type Deployment = {
  id: string;
  environment: string;
  status: string;
  commitSha: string | null;
  timestamp: string;
  runId: string | null;
};
export type DashboardPayload = {
  projects: number;
  totalBuilds: number;
  failedBuilds: number;
  successfulBuilds: number;
  successRate: number;
  projectList: Project[];
  recentRuns: PipelineRun[];
};
export type MetricsPayload = {
  projectId: string;
  successRate: number;
  avgBuildDurationMs: number;
  deploymentSuccessRate: number;
  totalRuns: number;
  failedRuns: number;
  totalDeployments: number;
  series: Array<{
    date: string;
    success: number;
    failure: number;
    avgDurationMs: number;
    deployments: number;
  }>;
};
