import { Router } from "express";
import { decryptSecret, encryptSecret, generateWebhookSecret } from "../crypto.js";
import { eventBus } from "../eventBus.js";
import { GitHubApiError, getRateLimit, getWorkflowYaml, listWorkflows } from "../github.js";



import { findOwnedProject } from "../projectAccess.js";
import { prisma } from "../prisma.js";
import { jsonSafe, publicProject } from "../serialize.js";
import { syncProjectFromGitHub } from "../sync.js";

export const projectsRouter = Router();

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

projectsRouter.post("/", async (req, res, next) => {
  try {
    const { owner, repo, githubToken, name } = req.body ?? {};
    if (!owner || !repo || !githubToken) {
      return res.status(400).json({
        error: "owner, repo, and githubToken are required",
      });
    }

    const webhookSecret = generateWebhookSecret();

    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        owner,
        repo,
        name: name || `${owner}/${repo}`,
        githubTokenEnc: encryptSecret(githubToken),
        webhookSecret,
      },
    });

    res.status(201).json({
      ...publicProject(project),
      webhookSecret, // returned only once upon creation
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "project already registered for that owner/repo" });
    }
    next(err);
  }
});

projectsRouter.get("/", async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects.map(publicProject));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });
    res.json(publicProject(project));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/webhook-secret", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const webhookSecret = generateWebhookSecret();
    await prisma.project.update({
      where: { id: project.id },
      data: { webhookSecret },
    });

    res.json({ webhookSecret });
  } catch (err) {
    next(err);
  }
});


projectsRouter.post("/:id/sync", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const includeJobs = req.body?.includeJobs !== false;
    const maxRuns = parsePositiveInt(req.body?.maxRuns, 20, { min: 1, max: 50 });

    const result = await syncProjectFromGitHub(project, { includeJobs, maxRuns });
    res.json(jsonSafe(result));
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return res.status(502).json({
        error: "GitHub API request failed",
        status: err.status,
        details: err.body,
        rateLimitRemaining: err.headers.rateLimitRemaining,
      });
    }
    next(err);
  }
});

projectsRouter.get("/:id/runs", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const runs = await prisma.pipelineRun.findMany({
      where: { projectId: project.id },
      orderBy: { startedAt: "desc" },
      take: parsePositiveInt(req.query.limit, 50, { min: 1, max: 200 }),
    });
    res.json(jsonSafe(runs));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id/runs/:runId", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const run = await prisma.pipelineRun.findFirst({
      where: { id: req.params.runId, projectId: project.id },
      include: {
        jobs: {
          orderBy: { startedAt: "asc" },
          include: { steps: { orderBy: { number: "asc" } } },
        },
      },
    });
    if (!run) return res.status(404).json({ error: "run not found" });
    res.json(jsonSafe(run));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id/deployments", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const deployments = await prisma.deployment.findMany({
      where: { projectId: project.id },
      orderBy: { timestamp: "desc" },
      take: parsePositiveInt(req.query.limit, 50, { min: 1, max: 200 }),
      include: {
        run: {
          select: { id: true, branch: true, workflowName: true },
        },
      },
    });
    res.json(jsonSafe(deployments));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id/rate-limit", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const token = decryptSecret(project.githubTokenEnc);
    const result = await getRateLimit(token);
    res.json(result);
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return res.status(err.status || 502).json({
        error: err.message,
        isRateLimit: err.isRateLimit,
      });
    }
    next(err);
  }
});

projectsRouter.get("/:id/workflows", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const token = decryptSecret(project.githubTokenEnc);
    const payload = await listWorkflows(project.owner, project.repo, token);
    res.json(jsonSafe(payload));
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return res.status(err.status || 502).json({
        error: err.message,
        isRateLimit: err.isRateLimit,
      });
    }
    next(err);
  }
});

projectsRouter.get("/:id/workflows/:workflowId", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) return res.status(404).json({ error: "project not found" });

    const token = decryptSecret(project.githubTokenEnc);
    const result = await getWorkflowYaml(
      project.owner,
      project.repo,
      req.params.workflowId,
      token,
      req.query.ref,
    );
    res.json(jsonSafe(result));
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return res.status(err.status || 502).json({
        error: err.message,
        isRateLimit: err.isRateLimit,
      });
    }
    next(err);
  }
});


projectsRouter.post("/:id/test-event", async (req, res, next) => {
  try {
    let project = await findOwnedProject(req.user.id, req.params.id);
    if (!project) {
      project = await prisma.project.findFirst({ where: { userId: req.user.id } });
    }
    if (!project) return res.status(404).json({ error: "project not found" });

    const conclusions = ["success", "failure", "in_progress"];
    const conclusionChoice =
      req.body?.conclusion ||
      conclusions[Math.floor(Math.random() * conclusions.length)];
    const isCompleted = conclusionChoice !== "in_progress";
    const status = isCompleted ? "completed" : "in_progress";
    const conclusion = isCompleted ? conclusionChoice : null;

    const fakeRunId = Math.floor(100000 + Math.random() * 900000);
    const fakeSha = Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
    const branches = ["main", "feature/auth", "hotfix/db", "feat/realtime-sse"];
    const branch =
      req.body?.branch ||
      branches[Math.floor(Math.random() * branches.length)];
    const startedAt = new Date();
    const durationMs = isCompleted
      ? Math.floor(30000 + Math.random() * 180000)
      : null;
    const completedAt = isCompleted
      ? new Date(startedAt.getTime() + durationMs)
      : null;

    const run = await prisma.pipelineRun.create({
      data: {
        githubRunId: BigInt(fakeRunId),
        projectId: project.id,
        workflowName: req.body?.workflowName || "CI/CD Pipeline",
        status,
        conclusion,
        branch,
        commitSha: fakeSha,
        commitMessage:
          req.body?.message || `test: synthetic pipeline run #${fakeRunId}`,
        htmlUrl: `https://github.com/${project.owner}/${project.repo}/actions/runs/${fakeRunId}`,
        startedAt,
        completedAt,
        durationMs,
      },
    });

    const job = await prisma.pipelineJob.create({
      data: {
        githubJobId: BigInt(fakeRunId * 10),
        runId: run.id,
        name: "build-and-test",
        status,
        conclusion,
        startedAt,
        completedAt,
      },
    });

    const stepNames = ["checkout", "install", "test", "build", "deploy"];
    await prisma.pipelineStep.createMany({
      data: stepNames.map((name, idx) => ({
        jobId: job.id,
        number: idx + 1,
        name,
        status: isCompleted ? "completed" : idx === 0 ? "in_progress" : "queued",
        conclusion: isCompleted
          ? conclusion === "failure" && name === "test"
            ? "failure"
            : "success"
          : null,
        startedAt: new Date(startedAt.getTime() + idx * 5000),
        completedAt: isCompleted
          ? new Date(startedAt.getTime() + (idx + 1) * 5000)
          : null,
      })),
    });

    if (isCompleted && conclusion === "success") {
      await prisma.deployment.create({
        data: {
          projectId: project.id,
          runId: run.id,
          environment: "production",
          status: "success",
          commitSha: fakeSha,
          timestamp: completedAt || new Date(),
        },
      });

      eventBus.broadcast({
        eventName: "deployment.created",
        type: "deployment",
        projectId: project.id,
        projectName: project.name,
        runId: run.id,
        environment: "production",
        status: "success",
        commitSha: fakeSha,
        title: `Deployment to production (success)`,
      });
    }

    const eventName = isCompleted ? "run.completed" : "run.updated";
    const broadcastedEvent = eventBus.broadcast({
      eventName,
      type: "workflow_run",
      action: isCompleted ? "completed" : "requested",
      projectId: project.id,
      projectName: project.name,
      runId: run.id,
      githubRunId: String(fakeRunId),
      workflowName: run.workflowName,
      status,
      conclusion,
      branch,
      commitSha: fakeSha,
      commitMessage: run.commitMessage,
      title: `Workflow "${run.workflowName}" ${conclusion || status}`,
    });

    res.json({ ok: true, event: broadcastedEvent, run: jsonSafe(run) });
  } catch (err) {
    next(err);
  }
});
