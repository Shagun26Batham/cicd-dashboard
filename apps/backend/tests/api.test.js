import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
process.env.TRUST_PROXY = "1";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

import { createApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { COOKIE_NAME } from "../src/auth.js";

let server;
let baseUrl;
let testUserEmail;
let testUserPassword = "password123";
let authCookie;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  // Cleanup test user if created
  if (testUserEmail) {
    await prisma.user.deleteMany({ where: { email: testUserEmail } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test("GET /health returns 200 and service identity", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, "cicd-dashboard-backend");
});

test("GET /health reports database failures with 503", async () => {
  const originalQueryRaw = prisma.$queryRaw;
  prisma.$queryRaw = async () => {
    throw Object.assign(new Error("database connection details"), { code: "P1001" });
  };

  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), {
      ok: false,
      service: "cicd-dashboard-backend",
      database: "disconnected",
      error: "database unavailable",
    });
  } finally {
    prisma.$queryRaw = originalQueryRaw;
  }
});

test("POST /api/auth/register creates a user and sets session cookie", async () => {
  testUserEmail = `test-${Date.now()}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.email, testUserEmail);

  // Read set-cookie
  const rawCookie = res.headers.get("set-cookie");
  assert.ok(rawCookie, "set-cookie header should be present");
  authCookie = rawCookie.split(";")[0];
});

test("GET /api/auth/me returns authenticated user with valid cookie", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: authCookie },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.email, testUserEmail);
});

test("GET /api/auth/me returns 401 without cookie", async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
});

test("GET /api/dashboard returns metrics and project list for authenticated user", async () => {
  const res = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Cookie: authCookie },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.projects === "number");
  assert.ok(typeof data.totalBuilds === "number");
  assert.ok(Array.isArray(data.projectList));
  assert.ok(Array.isArray(data.recentRuns));
});

test("POST /api/webhooks/github verifies GitHub ping signatures", async () => {
  const secret = "super-secret-hmac-key";
  const project = await prisma.project.create({
    data: {
      owner: `ping-org-${Date.now()}`,
      repo: "ping-repo",
      name: "Ping Test Repo",
      githubTokenEnc: "not-real-token",
      webhookSecret: secret,
      user: {
        create: {
          email: `ping-owner-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      },
    },
  });
  const payload = JSON.stringify({
    repository: { owner: { login: project.owner }, name: project.repo },
    zen: "Keep it logically awesome.",
    hook_id: 12345,
  });
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const unsigned = await fetch(`${baseUrl}/api/webhooks/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GitHub-Event": "ping" },
      body: payload,
    });
    assert.equal(unsigned.status, 401);

    const res = await fetch(`${baseUrl}/api/webhooks/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "ping",
        "X-Hub-Signature-256": `sha256=${signature}`,
      },
      body: payload,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, "pong");
    assert.equal(data.hook_id, 12345);
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.delete({ where: { id: project.userId } });
  }
});

test("POST /api/webhooks/github rejects invalid HMAC signature when secret configured", async () => {
  // Create a temporary project with a known secret
  const project = await prisma.project.create({
    data: {
      owner: `test-org-${Date.now()}`,
      repo: "test-repo",
      name: "Webhook Test Repo",
      githubTokenEnc: "not-real-token",
      webhookSecret: "super-secret-hmac-key",
      user: {
        create: {
          email: `owner-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      },
    },
  });

  const payload = JSON.stringify({
    repository: { owner: { login: project.owner }, name: project.repo },
    workflow_run: { id: 88888, status: "completed", conclusion: "success" },
  });

  const res = await fetch(`${baseUrl}/api/webhooks/github`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "workflow_run",
      "X-Hub-Signature-256": "sha256=invalidhashvalue000000000000000000000000000000000000000000000000",
    },
    body: payload,
  });

  assert.equal(res.status, 401);

  // Now test with VALID signature
  const validHmac = crypto.createHmac("sha256", "super-secret-hmac-key").update(payload).digest("hex");
  const validRes = await fetch(`${baseUrl}/api/webhooks/github`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "workflow_run",
      "X-Hub-Signature-256": `sha256=${validHmac}`,
    },
    body: payload,
  });

  assert.equal(validRes.status, 200);

  // Clean up
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.user.delete({ where: { id: project.userId } });
});

test("POST /api/projects/:id/test-event broadcasts live telemetry event", async () => {
  // Create a project for the test user so we have a valid project ID
  const projRes = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({
      owner: `test-event-org-${Date.now()}`,
      repo: "test-event-repo",
      githubToken: "fake-token-for-test-event",
    }),
  });
  assert.equal(projRes.status, 201, "project creation should succeed");
  const project = await projRes.json();

  // Verify unauthenticated request is rejected with 401
  const unauthRes = await fetch(`${baseUrl}/api/projects/${project.id}/test-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conclusion: "success" }),
  });
  assert.equal(unauthRes.status, 401, "unauthenticated test-event should return 401");

  const res = await fetch(`${baseUrl}/api/projects/${project.id}/test-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({ conclusion: "success" }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.event.type, "workflow_run");
  assert.equal(data.run.projectId, project.id);
  assert.equal(data.run.conclusion, "success");

  // Verify the run was persisted to database
  const dbRun = await prisma.pipelineRun.findUnique({ where: { id: data.run.id } });
  assert.ok(dbRun, "pipeline run should be persisted in database");
  assert.equal(dbRun.projectId, project.id);
  assert.equal(dbRun.status, "completed");
  // The project and all its pipeline records are cleaned up by cascade when the
  // test user (testUserEmail) is deleted in the after() hook.
});

test("POST /api/users is removed and returns 404", async () => {
  const res = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "legacy@example.com", password: "password123" }),
  });
  assert.equal(res.status, 404);
});

test("POST /api/auth/register rejects invalid email format", async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.10",
    },
    body: JSON.stringify({ email: "invalid-email-format", password: "password123" }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "invalid email address");
});

test("POST /api/auth/register enforces rate limit with 429", async () => {
  const ip = "198.51.100.20";
  for (let i = 0; i < 10; i++) {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ email: "invalid", password: "short" }),
    });
  }
  const blockedRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({ email: "test@example.com", password: "password123" }),
  });
  assert.equal(blockedRes.status, 429);
  assert.ok(Number(blockedRes.headers.get("retry-after")) > 0);
});

test("POST /api/auth/login enforces rate limit with 429", async () => {
  const ip = "198.51.100.21";
  for (let i = 0; i < 10; i++) {
    await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
      },
      body: JSON.stringify({ email: "unknown@example.com", password: "wrong-password" }),
    });
  }
  const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
    body: JSON.stringify({ email: "unknown@example.com", password: "wrong-password" }),
  });
  assert.equal(blockedRes.status, 429);
  assert.ok(Number(blockedRes.headers.get("retry-after")) > 0);
});

test("POST /api/webhooks/github rejects request when project has no secret configured", async () => {
  const projectWithoutSecret = await prisma.project.create({
    data: {
      owner: `no-secret-org-${Date.now()}`,
      repo: "no-secret-repo",
      name: "No Secret Repo",
      githubTokenEnc: "not-real-token",
      webhookSecret: null,
      user: {
        create: {
          email: `no-secret-${Date.now()}@example.com`,
          passwordHash: "hash",
        },
      },
    },
  });

  const savedEnvSecret = process.env.WEBHOOK_SECRET;
  delete process.env.WEBHOOK_SECRET;

  try {
    const payload = JSON.stringify({
      repository: { owner: { login: projectWithoutSecret.owner }, name: projectWithoutSecret.repo },
      workflow_run: { id: 99999, status: "completed", conclusion: "success" },
    });

    const res = await fetch(`${baseUrl}/api/webhooks/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_run",
      },
      body: payload,
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, "webhook verification secret not configured");
  } finally {
    if (savedEnvSecret) process.env.WEBHOOK_SECRET = savedEnvSecret;
    await prisma.project.delete({ where: { id: projectWithoutSecret.id } });
    await prisma.user.delete({ where: { id: projectWithoutSecret.userId } });
  }
});

test("GET /api/events/recent isolates events by project ownership", async () => {
  const user2Email = `user2-${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.30",
    },
    body: JSON.stringify({ email: user2Email, password: "password123" }),
  });
  assert.equal(regRes.status, 201);
  const user2Cookie = regRes.headers.get("set-cookie").split(";")[0];

  const p1Res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({
      owner: `user1-org-${Date.now()}`,
      repo: "user1-repo",
      githubToken: "token1",
    }),
  });
  const project1 = await p1Res.json();

  await fetch(`${baseUrl}/api/projects/${project1.id}/test-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({ conclusion: "success" }),
  });

  const u2RecentRes = await fetch(`${baseUrl}/api/events/recent`, {
    headers: { Cookie: user2Cookie },
  });
  assert.equal(u2RecentRes.status, 200);
  const u2Events = await u2RecentRes.json();
  const leaked = u2Events.events.some((e) => e.projectId === project1.id);
  assert.equal(leaked, false, "User 2 should not see User 1 project events");

  const u1RecentRes = await fetch(`${baseUrl}/api/events/recent`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(u1RecentRes.status, 200);
  const u1Events = await u1RecentRes.json();
  const seen = u1Events.events.some((e) => e.projectId === project1.id);
  assert.equal(seen, true, "User 1 should see own project events");

  await prisma.user.deleteMany({ where: { email: user2Email } });
});

test("GET /api/events isolates live SSE events by project ownership", async () => {
  const user2Email = `sse-user2-${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.31",
    },
    body: JSON.stringify({ email: user2Email, password: "password123" }),
  });
  assert.equal(regRes.status, 201);
  const user2Cookie = regRes.headers.get("set-cookie").split(";")[0];
  const project1Response = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({
      owner: `sse-user1-${Date.now()}`,
      repo: "private-repo",
      githubToken: "token1",
    }),
  });
  const project1 = await project1Response.json();
  const project2Response = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user2Cookie },
    body: JSON.stringify({
      owner: `sse-user2-${Date.now()}`,
      repo: "owned-repo",
      githubToken: "token2",
    }),
  });
  const project2 = await project2Response.json();
  const controller = new AbortController();

  try {
    const streamResponse = await fetch(`${baseUrl}/api/events`, {
      headers: { Cookie: user2Cookie },
      signal: controller.signal,
    });
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get("content-type"), /text\/event-stream/);
    const reader = streamResponse.body.getReader();
    const decoder = new TextDecoder();
    const handshake = await reader.read();
    assert.equal(handshake.done, false);
    assert.equal(decoder.decode(handshake.value).includes(project1.id), false);

    for (const project of [project1, project2]) {
      const eventRes = await fetch(`${baseUrl}/api/projects/${project.id}/test-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: project.id === project1.id ? authCookie : user2Cookie,
        },
        body: JSON.stringify({ conclusion: "failure" }),
      });
      assert.equal(eventRes.status, 200);
    }

    let streamText = "";
    while (!streamText.includes(project2.id)) {
      const { value, done } = await reader.read();
      assert.equal(done, false, "SSE stream should remain open for owned project events");
      streamText += decoder.decode(value, { stream: true });
    }
    assert.equal(streamText.includes(project1.id), false);
    assert.equal(streamText.includes(project2.id), true);
    await reader.cancel();
  } finally {
    controller.abort();
    await prisma.user.deleteMany({ where: { email: user2Email } });
  }
});

test("GET /api/metrics/:projectId returns aggregated metrics without loading all runs into memory", async () => {
  const projRes = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({
      owner: `metrics-org-${Date.now()}`,
      repo: "metrics-repo",
      githubToken: "metrics-token",
    }),
  });
  const project = await projRes.json();

  await fetch(`${baseUrl}/api/projects/${project.id}/test-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify({ conclusion: "success" }),
  });

  const res = await fetch(`${baseUrl}/api/metrics/${project.id}`, {
    headers: { Cookie: authCookie },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.projectId, project.id);
  assert.ok(typeof data.successRate === "number");
  assert.ok(typeof data.avgBuildDurationMs === "number");
  assert.ok(typeof data.totalRuns === "number");
  assert.equal(data.totalRuns, 1);
  assert.equal(data.successRate, 1);
  assert.equal(data.failedRuns, 0);
  assert.equal(data.totalDeployments, 1);
  assert.ok(Array.isArray(data.series));
  assert.equal(data.series.reduce((total, day) => total + day.success, 0), 1);
  assert.equal(data.series.reduce((total, day) => total + day.failure, 0), 0);

  const storedRun = await prisma.pipelineRun.findFirst({ where: { projectId: project.id } });
  assert.equal(data.avgBuildDurationMs, storedRun.durationMs);
  assert.equal(
    data.series.reduce((duration, day) => duration + day.avgDurationMs, 0),
    storedRun.durationMs,
  );
});

test("POST /api/auth/logout clears auth cookie with matching attributes", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.headers.get("set-cookie").includes("Secure"));
    const loginCookie = loginRes.headers.get("set-cookie").split(";")[0];

    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: loginCookie },
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "set-cookie header should be present");
    assert.ok(setCookie.includes("cid_session="));
    assert.ok(setCookie.includes("Path=/"));
    assert.ok(setCookie.includes("HttpOnly"));
    assert.ok(setCookie.includes("SameSite=Lax"));
    assert.ok(setCookie.includes("Secure"));
    assert.ok(Date.parse(setCookie.match(/Expires=([^;]+)/)?.[1] ?? "") < Date.now());
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
