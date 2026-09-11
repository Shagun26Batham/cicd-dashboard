const DEFAULT_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(status, body, headers = {}) {
    super(`GitHub API ${status}: ${body}`);
    this.name = "GitHubApiError";
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export async function githubFetch(path, token) {
  const base = process.env.GITHUB_API_BASE || DEFAULT_BASE;
  const res = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cicd-dashboard",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GitHubApiError(res.status, text, {
      retryAfter: res.headers.get("retry-after"),
      rateLimitRemaining: res.headers.get("x-ratelimit-remaining"),
      rateLimitReset: res.headers.get("x-ratelimit-reset"),
    });
  }

  return res.json();
}

export function listWorkflowRuns(owner, repo, token, { perPage = 30, page = 1 } = {}) {
  const q = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  return githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?${q}`,
    token,
  );
}

export function listJobsForRun(owner, repo, runId, token) {
  return githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/jobs?per_page=100`,
    token,
  );
}
