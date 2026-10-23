const DEFAULT_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(status, body, headers = {}) {
    super(`GitHub API ${status}: ${body}`);
    this.name = "GitHubApiError";
    this.status = status;
    this.body = body;
    this.headers = headers;
    this.isRateLimit =
      status === 429 ||
      (status === 403 && headers.rateLimitRemaining === "0");
  }
}

export async function githubFetch(path, token, options = {}) {
  const base = process.env.GITHUB_API_BASE || DEFAULT_BASE;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: options.headers?.Accept || "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cicd-dashboard",
    ...(options.headers || {}),
  };

  const fetchOptions = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    if (typeof options.body === "object" && !Buffer.isBuffer(options.body)) {
      fetchOptions.body = JSON.stringify(options.body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    } else {
      fetchOptions.body = options.body;
    }
  }

  const res = await fetch(`${base}${path}`, fetchOptions);

  const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
  const rateLimitReset = res.headers.get("x-ratelimit-reset");
  const retryAfter = res.headers.get("retry-after");

  if (!res.ok) {
    const text = await res.text();
    let message = text;

    if (res.status === 429 || (res.status === 403 && rateLimitRemaining === "0")) {
      const resetSeconds = rateLimitReset
        ? Math.max(0, Math.ceil(Number(rateLimitReset) - Date.now() / 1000))
        : null;
      message = `GitHub API rate limit exceeded.${
        resetSeconds ? ` Quota resets in ${Math.ceil(resetSeconds / 60)} minutes.` : ""
      }`;
    }

    throw new GitHubApiError(res.status, message, {
      retryAfter,
      rateLimitRemaining,
      rateLimitReset,
    });
  }

  if (options.raw) {
    return {
      res,
      rateLimit: {
        remaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
        reset: rateLimitReset ? Number(rateLimitReset) : null,
      },
    };
  }

  let data = null;
  const contentLength = res.headers.get("content-length");
  if (res.status !== 204 && res.status !== 205 && contentLength !== "0") {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  }

  return {
    data,
    status: res.status,
    headers: res.headers,
    rateLimit: {
      remaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
      reset: rateLimitReset ? Number(rateLimitReset) : null,
    },
  };
}

export async function listWorkflowRuns(owner, repo, token, { perPage = 30, page = 1 } = {}) {
  const q = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  const res = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?${q}`,
    token,
  );
  return res.data;
}

export async function listJobsForRun(owner, repo, runId, token) {
  const res = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/jobs?per_page=100`,
    token,
  );
  return res.data;
}

export async function getRateLimit(token) {
  const res = await githubFetch("/rate_limit", token);
  return res.data;
}

// ---------------------------------------------------------------------------
// FEATURE 1: WORKFLOW YAML VIEWER APIS
// ---------------------------------------------------------------------------

export async function listWorkflows(owner, repo, token) {
  const res = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows`,
    token,
  );
  return res.data;
}

export async function getWorkflow(owner, repo, workflowId, token) {
  const res = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowId)}`,
    token,
  );
  return res.data;
}

export async function getRepositoryContent(owner, repo, path, token, ref) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const pathParts = cleanPath.split("/").map(encodeURIComponent).join("/");
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${pathParts}${q}`,
    token,
  );
  return res.data;
}

export async function getWorkflowYaml(owner, repo, workflowId, token, ref) {
  // Retrieve workflow metadata from GitHub Actions
  const workflow = await getWorkflow(owner, repo, workflowId, token);
  if (!workflow || !workflow.path) {
    throw new GitHubApiError(404, "Workflow not found or missing path");
  }

  // Retrieve file content from GitHub repository contents API
  const fileData = await getRepositoryContent(owner, repo, workflow.path, token, ref);
  let yamlContent = "";
  if (typeof fileData === "string") {
    yamlContent = fileData;
  } else if (fileData?.content && fileData.encoding === "base64") {
    yamlContent = Buffer.from(fileData.content, "base64").toString("utf8");
  } else if (fileData?.content) {
    yamlContent = fileData.content;
  }

  return {
    workflow: {
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      htmlUrl: workflow.html_url,
      badgeUrl: workflow.badge_url,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
    },
    content: yamlContent,
    sha: fileData?.sha,
    size: fileData?.size,
    ref: ref || null,
  };
}
