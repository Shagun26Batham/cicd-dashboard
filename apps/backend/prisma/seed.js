import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

const STEP_NAMES = ["checkout", "install", "test", "build", "deploy"];
const ENVIRONMENTS = ["staging", "production"];

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function durationBetween(start, end) {
  return Math.max(0, end.getTime() - start.getTime());
}

async function seedProject(userId, spec) {
  const existing = await prisma.project.findUnique({
    where: { owner_repo: { owner: spec.owner, repo: spec.repo } },
  });
  const project =
    existing ??
    (await prisma.project.create({
      data: {
        userId,
        owner: spec.owner,
        repo: spec.repo,
        name: spec.name,
        githubTokenEnc: encryptSecret("seed-token-not-a-real-github-pat"),
      },
    }));

  await prisma.pipelineStep.deleteMany({
    where: { job: { run: { projectId: project.id } } },
  });
  await prisma.pipelineJob.deleteMany({
    where: { run: { projectId: project.id } },
  });
  await prisma.deployment.deleteMany({ where: { projectId: project.id } });
  await prisma.pipelineRun.deleteMany({ where: { projectId: project.id } });

  let githubRunId = spec.runIdBase;
  for (const runSpec of spec.runs) {
    const startedAt = hoursAgo(runSpec.hoursAgo);
    const completedAt = new Date(startedAt.getTime() + runSpec.durationMs);
    const run = await prisma.pipelineRun.create({
      data: {
        githubRunId: BigInt(githubRunId),
        projectId: project.id,
        workflowName: runSpec.workflow,
        status: "completed",
        conclusion: runSpec.conclusion,
        branch: runSpec.branch,
        commitSha: runSpec.sha,
        commitMessage: runSpec.message,
        htmlUrl: `https://github.com/${spec.owner}/${spec.repo}/actions/runs/${githubRunId}`,
        startedAt,
        completedAt,
        durationMs: durationBetween(startedAt, completedAt),
      },
    });
    githubRunId += 1;

    const failAt = runSpec.failStep ?? null;
    const job = await prisma.pipelineJob.create({
      data: {
        githubJobId: BigInt(githubRunId * 10),
        runId: run.id,
        name: "CI",
        status: "completed",
        conclusion: runSpec.conclusion,
        startedAt,
        completedAt,
      },
    });

    await prisma.pipelineStep.createMany({
      data: STEP_NAMES.map((name, index) => {
        const number = index + 1;
        let conclusion = "success";
        if (failAt && name === failAt) conclusion = "failure";
        else if (failAt && STEP_NAMES.indexOf(failAt) < index) conclusion = "skipped";
        const stepStart = new Date(startedAt.getTime() + index * 20000);
        const stepEnd =
          conclusion === "skipped" ? null : new Date(stepStart.getTime() + 15000);
        return {
          jobId: job.id,
          number,
          name,
          status: "completed",
          conclusion,
          startedAt: conclusion === "skipped" ? null : stepStart,
          completedAt: stepEnd,
        };
      }),
    });

    if (runSpec.deploy) {
      await prisma.deployment.create({
        data: {
          projectId: project.id,
          runId: run.id,
          environment: runSpec.environment || ENVIRONMENTS[0],
          status: runSpec.deployStatus || "success",
          commitSha: runSpec.sha,
          timestamp: completedAt,
        },
      });
    }
  }

  return project;
}

async function main() {
  const email = "demo@local.test";
  const password = "changeme";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  }

  await seedProject(user.id, {
    owner: "acme",
    repo: "web-app",
    name: "Acme Web App",
    runIdBase: 900001,
    runs: [
      { hoursAgo: 320, durationMs: 210000, conclusion: "success", branch: "main", sha: "a1b2c3d4e5", message: "chore: bootstrap CI", workflow: "CI", deploy: true, environment: "staging" },
      { hoursAgo: 280, durationMs: 185000, conclusion: "success", branch: "main", sha: "b2c3d4e5f6", message: "feat: auth pages", workflow: "CI", deploy: true, environment: "production" },
      { hoursAgo: 240, durationMs: 265000, conclusion: "failure", branch: "main", sha: "c3d4e5f6a7", message: "fix: flaky login test", workflow: "CI", failStep: "test" },
      { hoursAgo: 200, durationMs: 198000, conclusion: "success", branch: "main", sha: "d4e5f6a7b8", message: "test: stabilize suite", workflow: "CI", deploy: true, environment: "staging" },
      { hoursAgo: 160, durationMs: 312000, conclusion: "failure", branch: "feat/charts", sha: "e5f6a7b8c9", message: "feat: analytics charts", workflow: "CI", failStep: "install" },
      { hoursAgo: 120, durationMs: 176000, conclusion: "success", branch: "feat/charts", sha: "f6a7b8c9d0", message: "fix: lockfile", workflow: "CI" },
      { hoursAgo: 72, durationMs: 154000, conclusion: "success", branch: "main", sha: "17a8b9c0d1", message: "chore: bump next", workflow: "CI", deploy: true, environment: "production" },
      { hoursAgo: 36, durationMs: 402000, conclusion: "failure", branch: "main", sha: "28b9c0d1e2", message: "feat: deploy workflow", workflow: "CI", failStep: "deploy", deploy: true, deployStatus: "failure", environment: "production" },
      { hoursAgo: 12, durationMs: 188000, conclusion: "success", branch: "main", sha: "39c0d1e2f3", message: "fix: deploy secrets", workflow: "CI", deploy: true, environment: "production" },
      { hoursAgo: 3, durationMs: 142000, conclusion: "success", branch: "main", sha: "4ad1e2f304", message: "docs: readme polish", workflow: "CI" },
    ],
  });

  await seedProject(user.id, {
    owner: "acme",
    repo: "api-gateway",
    name: "API Gateway",
    runIdBase: 910001,
    runs: [
      { hoursAgo: 300, durationMs: 90000, conclusion: "success", branch: "main", sha: "111aaa222b", message: "init gateway", workflow: "CI", deploy: true, environment: "staging" },
      { hoursAgo: 210, durationMs: 125000, conclusion: "failure", branch: "main", sha: "222bbb333c", message: "feat: rate limits", workflow: "CI", failStep: "build" },
      { hoursAgo: 96, durationMs: 110000, conclusion: "success", branch: "main", sha: "333ccc444d", message: "fix: docker build", workflow: "CI", deploy: true, environment: "production" },
      { hoursAgo: 48, durationMs: 98000, conclusion: "success", branch: "main", sha: "444ddd555e", message: "perf: cache headers", workflow: "CI" },
      { hoursAgo: 8, durationMs: 205000, conclusion: "failure", branch: "hotfix/timeouts", sha: "555eee666f", message: "hotfix: timeouts", workflow: "CI", failStep: "test" },
    ],
  });

  await seedProject(user.id, {
    owner: "acme",
    repo: "data-pipeline",
    name: "Data Pipeline",
    runIdBase: 920001,
    runs: [
      { hoursAgo: 180, durationMs: 340000, conclusion: "success", branch: "main", sha: "999fff111a", message: "feat: etl job scheduler", workflow: "ETL", deploy: true, environment: "production" },
      { hoursAgo: 70, durationMs: 290000, conclusion: "success", branch: "main", sha: "888eee222b", message: "perf: optimize parquet sinks", workflow: "ETL", deploy: true, environment: "staging" },
      { hoursAgo: 14, durationMs: 420000, conclusion: "failure", branch: "feat/streaming", sha: "777ddd333c", message: "feat: kafka stream joiner", workflow: "ETL", failStep: "test" },
      { hoursAgo: 1, durationMs: 195000, conclusion: "success", branch: "feat/streaming", sha: "666ccc444d", message: "fix: handle schema evolution", workflow: "ETL", deploy: true, environment: "staging" },
    ],
  });

  console.log(`Seeded demo user ${email} / ${password} with 3 projects and rich telemetry`);
}


main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
