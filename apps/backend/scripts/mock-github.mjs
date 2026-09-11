import http from "node:http";

const PORT = Number.parseInt(process.env.MOCK_GITHUB_PORT ?? "4100", 10);

const runs = {
  total_count: 1,
  workflow_runs: [
    {
      id: 101,
      name: "CI",
      status: "completed",
      conclusion: "failure",
      head_branch: "main",
      head_sha: "abc123def456",
      html_url: "https://github.com/acme/demo/actions/runs/101",
      run_started_at: "2026-09-11T10:00:00Z",
      updated_at: "2026-09-11T10:05:00Z",
      display_title: "fix flaky tests",
    },
  ],
};

const jobs = {
  jobs: [
    {
      id: 201,
      name: "build",
      status: "completed",
      conclusion: "failure",
      started_at: "2026-09-11T10:00:05Z",
      completed_at: "2026-09-11T10:05:00Z",
      steps: [
        {
          number: 1,
          name: "checkout",
          status: "completed",
          conclusion: "success",
          started_at: "2026-09-11T10:00:06Z",
          completed_at: "2026-09-11T10:00:20Z",
        },
        {
          number: 2,
          name: "install",
          status: "completed",
          conclusion: "success",
          started_at: "2026-09-11T10:00:21Z",
          completed_at: "2026-09-11T10:01:10Z",
        },
        {
          number: 3,
          name: "test",
          status: "completed",
          conclusion: "failure",
          started_at: "2026-09-11T10:01:11Z",
          completed_at: "2026-09-11T10:04:50Z",
        },
        {
          number: 4,
          name: "build",
          status: "completed",
          conclusion: "skipped",
          started_at: null,
          completed_at: null,
        },
        {
          number: 5,
          name: "deploy",
          status: "completed",
          conclusion: "skipped",
          started_at: null,
          completed_at: null,
        },
      ],
    },
  ],
};

const server = http.createServer((req, res) => {
  const url = req.url ?? "";
  res.setHeader("Content-Type", "application/json");
  if (url.startsWith("/repos/acme/demo/actions/runs/101/jobs")) {
    res.end(JSON.stringify(jobs));
    return;
  }
  if (url.startsWith("/repos/acme/demo/actions/runs")) {
    res.end(JSON.stringify(runs));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ message: "Not Found", path: url }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock GitHub listening on http://127.0.0.1:${PORT}`);
});
