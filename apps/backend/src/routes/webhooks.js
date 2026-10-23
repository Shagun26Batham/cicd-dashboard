import { Router } from "express";
import { verifyGitHubSignature } from "../crypto.js";
import { eventBus } from "../eventBus.js";
import { prisma } from "../prisma.js";

export const webhooksRouter = Router();

function toDate(val) {
  return val ? new Date(val) : null;
}

function durationMs(start, end) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

async function maybeRecordDeployment(projectId, runRecord, entity) {
  const name = entity.name ?? entity.workflowName ?? "";
  const looksLikeDeploy = /deploy/i.test(name);
  const status = entity.status;
  const conclusion = entity.conclusion;

  // Record deployment if it explicitly looks like deploy or if run completed successfully
  if (!looksLikeDeploy && conclusion !== "success") return null;

  const timestamp = toDate(entity.completed_at) ?? new Date();
  const depStatus = conclusion ?? status ?? "success";
  const envName = looksLikeDeploy ? name : "production";

  const existing = await prisma.deployment.findFirst({
    where: {
      projectId,
      runId: runRecord.id,
      environment: envName,
      commitSha: runRecord.commitSha,
    },
  });

  let deployment;
  if (existing) {
    deployment = await prisma.deployment.update({
      where: { id: existing.id },
      data: { status: depStatus, timestamp },
    });
  } else {
    deployment = await prisma.deployment.create({
      data: {
        projectId,
        runId: runRecord.id,
        environment: envName,
        status: depStatus,
        commitSha: runRecord.commitSha,
        timestamp,
      },
    });
  }

  // Publish deployment.created event
  eventBus.broadcast({
    eventName: "deployment.created",
    type: "deployment",
    projectId,
    runId: runRecord.id,
    environment: envName,
    status: depStatus,
    commitSha: runRecord.commitSha,
    timestamp: timestamp.toISOString(),
    title: `Deployment to ${envName} (${depStatus})`,
  });

  return deployment;
}

async function resolveProject(projectIdParam, payload) {
  if (projectIdParam) {
    return prisma.project.findUnique({ where: { id: projectIdParam } });
  }

  const repoOwner =
    payload?.repository?.owner?.login || payload?.repository?.owner?.name;
  const repoName = payload?.repository?.name;

  if (repoOwner && repoName) {
    return prisma.project.findUnique({
      where: { owner_repo: { owner: repoOwner, repo: repoName } },
    });
  }

  return null;
}

webhooksRouter.post(["/github", "/github/:projectId"], async (req, res) => {
  const eventType = req.headers["x-github-event"];
  const signature = req.headers["x-hub-signature-256"];

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

  let payload;
  try {
    payload = typeof req.body === "object" && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid JSON body" });
  }

  const project = await resolveProject(req.params.projectId, payload);
  if (!project) {
    return res.status(404).json({
      error: "project not registered for this repository",
    });
  }

  // HMAC verification against project's webhookSecret (or global WEBHOOK_SECRET fallback)
  const secret = project.webhookSecret || process.env.WEBHOOK_SECRET;
  if (!secret || secret.trim().length < 16) {
    return res.status(401).json({ error: "webhook verification secret not configured" });
  }

  const isValid = verifyGitHubSignature(rawBody, secret, signature);
  if (!isValid) {
    return res.status(401).json({ error: "invalid webhook signature" });
  }

  // GitHub ping handshakes are accepted only after the same HMAC check as other events.
  if (eventType === "ping") {
    return res.status(200).json({
      message: "pong",
      zen: payload?.zen,
      hook_id: payload?.hook_id,
    });
  }

  try {
    if (eventType === "workflow_run") {
      const run = payload.workflow_run;
      if (!run) return res.status(400).json({ error: "malformed workflow_run event" });

      const startedAt = toDate(run.run_started_at || run.created_at);
      const completedAt = run.status === "completed" ? toDate(run.updated_at) : null;

      const record = await prisma.pipelineRun.upsert({
        where: { githubRunId: BigInt(run.id) },
        create: {
          githubRunId: BigInt(run.id),
          projectId: project.id,
          workflowName: run.name ?? null,
          status: run.status,
          conclusion: run.conclusion ?? null,
          branch: run.head_branch ?? null,
          commitSha: run.head_sha ?? null,
          commitMessage: run.display_title ?? run.head_commit?.message ?? null,
          htmlUrl: run.html_url ?? null,
          startedAt,
          completedAt,
          durationMs: durationMs(startedAt, completedAt),
        },
        update: {
          workflowName: run.name ?? null,
          status: run.status,
          conclusion: run.conclusion ?? null,
          branch: run.head_branch ?? null,
          commitSha: run.head_sha ?? null,
          commitMessage: run.display_title ?? run.head_commit?.message ?? null,
          htmlUrl: run.html_url ?? null,
          startedAt,
          completedAt,
          durationMs: durationMs(startedAt, completedAt),
        },
      });

      // Create/update Deployment on completed + success
      if (run.status === "completed" && run.conclusion === "success") {
        await maybeRecordDeployment(project.id, record, run);
      }

      const isCompleted = run.status === "completed";
      const eventName = isCompleted ? "run.completed" : "run.updated";

      eventBus.broadcast({
        eventName,
        type: "workflow_run",
        action: payload.action,
        projectId: project.id,
        projectName: project.name,
        runId: record.id,
        githubRunId: String(run.id),
        workflowName: run.name,
        status: run.status,
        conclusion: run.conclusion,
        branch: run.head_branch,
        commitSha: run.head_sha,
        commitMessage: record.commitMessage,
        title: `Workflow "${run.name}" ${run.conclusion || run.status}`,
      });

      return res.json({ ok: true, runId: record.id });
    }

    if (eventType === "workflow_job") {
      const job = payload.workflow_job;
      if (!job) return res.status(400).json({ error: "malformed workflow_job event" });

      let runRecord = await prisma.pipelineRun.findUnique({
        where: { githubRunId: BigInt(job.run_id) },
      });

      if (!runRecord) {
        runRecord = await prisma.pipelineRun.create({
          data: {
            githubRunId: BigInt(job.run_id),
            projectId: project.id,
            workflowName: job.workflow_name ?? job.name,
            status: job.status,
            conclusion: job.conclusion ?? null,
            branch: job.head_branch ?? null,
            commitSha: job.head_sha ?? null,
            startedAt: toDate(job.started_at),
            completedAt: toDate(job.completed_at),
          },
        });
      }

      const startedAt = toDate(job.started_at);
      const completedAt = toDate(job.completed_at);

      const jobRecord = await prisma.pipelineJob.upsert({
        where: { githubJobId: BigInt(job.id) },
        create: {
          githubJobId: BigInt(job.id),
          runId: runRecord.id,
          name: job.name,
          status: job.status,
          conclusion: job.conclusion ?? null,
          startedAt,
          completedAt,
        },
        update: {
          name: job.name,
          status: job.status,
          conclusion: job.conclusion ?? null,
          startedAt,
          completedAt,
        },
      });

      if (Array.isArray(job.steps)) {
        await prisma.pipelineStep.deleteMany({ where: { jobId: jobRecord.id } });
        if (job.steps.length > 0) {
          await prisma.pipelineStep.createMany({
            data: job.steps.map((step) => ({
              jobId: jobRecord.id,
              number: step.number,
              name: step.name,
              status: step.status,
              conclusion: step.conclusion ?? null,
              startedAt: toDate(step.started_at),
              completedAt: toDate(step.completed_at),
            })),
          });
        }
      }

      if (job.status === "completed") {
        await maybeRecordDeployment(project.id, runRecord, job);
      }

      eventBus.broadcast({
        eventName: "job.updated",
        type: "workflow_job",
        action: payload.action,
        projectId: project.id,
        projectName: project.name,
        runId: runRecord.id,
        jobId: jobRecord.id,
        jobName: job.name,
        status: job.status,
        conclusion: job.conclusion,
        title: `Job "${job.name}" ${job.conclusion || job.status}`,
      });

      return res.json({ ok: true, jobId: jobRecord.id });
    }

    return res.status(200).json({ ok: true, message: `Ignored unhandled event ${eventType}` });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "webhook processing error" });
  }
});
