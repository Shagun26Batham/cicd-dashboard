import { decryptSecret } from "./crypto.js";
import { listJobsForRun, listWorkflowRuns } from "./github.js";
import { prisma } from "./prisma.js";

function durationMs(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

export async function syncProjectFromGitHub(project, { includeJobs = true, maxRuns = 30 } = {}) {
  const token = decryptSecret(project.githubTokenEnc);
  const payload = await listWorkflowRuns(project.owner, project.repo, token, {
    perPage: maxRuns,
    page: 1,
  });

  const runs = payload.workflow_runs ?? [];
  const saved = [];

  for (const run of runs) {
    const startedAt = toDate(run.run_started_at || run.created_at);
    const completedAt =
      run.status === "completed" ? toDate(run.updated_at) : null;

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

    if (includeJobs) {
      await syncJobsForRun(project, record, run.id, token);
    }

    saved.push(record);
  }

  return {
    totalCount: payload.total_count ?? runs.length,
    synced: saved.length,
    runs: saved,
  };
}

async function syncJobsForRun(project, runRecord, githubRunId, token) {
  const payload = await listJobsForRun(project.owner, project.repo, githubRunId, token);
  const jobs = payload.jobs ?? [];

  for (const job of jobs) {
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

    await prisma.pipelineStep.deleteMany({ where: { jobId: jobRecord.id } });

    const steps = job.steps ?? [];
    if (steps.length > 0) {
      await prisma.pipelineStep.createMany({
        data: steps.map((step) => ({
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

    await maybeRecordDeployment(project.id, runRecord, job);
  }
}

async function maybeRecordDeployment(projectId, runRecord, job) {
  const looksLikeDeploy = /deploy/i.test(job.name ?? "");
  if (!looksLikeDeploy || job.status !== "completed") return;

  const existing = await prisma.deployment.findFirst({
    where: {
      projectId,
      runId: runRecord.id,
      environment: job.name,
      commitSha: runRecord.commitSha,
    },
  });
  if (existing) {
    await prisma.deployment.update({
      where: { id: existing.id },
      data: {
        status: job.conclusion ?? job.status,
        timestamp: toDate(job.completed_at) ?? new Date(),
      },
    });
    return;
  }

  await prisma.deployment.create({
    data: {
      projectId,
      runId: runRecord.id,
      environment: job.name,
      status: job.conclusion ?? job.status,
      commitSha: runRecord.commitSha,
      timestamp: toDate(job.completed_at) ?? new Date(),
    },
  });
}
