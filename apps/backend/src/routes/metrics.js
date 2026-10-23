import { Router } from "express";
import { findOwnedProject } from "../projectAccess.js";
import { prisma } from "../prisma.js";

export const metricsRouter = Router();

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function emptyBuckets(days) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = isoDate(daysAgo(i));
    buckets.push({
      date,
      success: 0,
      failure: 0,
      avgDurationMs: 0,
      deployments: 0,
    });
  }
  return buckets;
}

metricsRouter.get("/:projectId", async (req, res, next) => {
  try {
    const project = await findOwnedProject(req.user.id, req.params.projectId);
    if (!project) return res.status(404).json({ error: "project not found" });

    const days = 14;
    const since = daysAgo(days - 1);
    const [
      runBuckets,
      deploymentBuckets,
      totalRuns,
      successfulRuns,
      failedRuns,
      durationAgg,
      totalDeployments,
      successfulDeployments,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('day', "startedAt"), 'YYYY-MM-DD') AS date,
          COUNT(*) FILTER (WHERE "conclusion" = 'success')::int AS success,
          COUNT(*) FILTER (WHERE "conclusion" = 'failure')::int AS failure,
          COALESCE(
            ROUND(AVG("durationMs") FILTER (WHERE "durationMs" IS NOT NULL AND "durationMs" >= 0)),
            0
          )::int AS "avgDurationMs"
        FROM "PipelineRun"
        WHERE "projectId" = ${project.id} AND "startedAt" >= ${since}
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT
          TO_CHAR(DATE_TRUNC('day', "timestamp"), 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS deployments
        FROM "Deployment"
        WHERE "projectId" = ${project.id} AND "timestamp" >= ${since}
        GROUP BY 1
      `,
      prisma.pipelineRun.count({
        where: { projectId: project.id },
      }),
      prisma.pipelineRun.count({
        where: { projectId: project.id, conclusion: "success" },
      }),
      prisma.pipelineRun.count({
        where: { projectId: project.id, conclusion: "failure" },
      }),
      prisma.pipelineRun.aggregate({
        where: { projectId: project.id, durationMs: { not: null, gte: 0 } },
        _avg: { durationMs: true },
      }),
      prisma.deployment.count({
        where: { projectId: project.id },
      }),
      prisma.deployment.count({
        where: {
          projectId: project.id,
          status: { in: ["success", "completed", "SUCCESS", "COMPLETED"] },
        },
      }),
    ]);

    const map = new Map(emptyBuckets(days).map((bucket) => [bucket.date, bucket]));
    for (const bucket of runBuckets) {
      const day = map.get(bucket.date);
      if (!day) continue;
      day.success = bucket.success;
      day.failure = bucket.failure;
      day.avgDurationMs = bucket.avgDurationMs;
    }
    for (const bucket of deploymentBuckets) {
      const day = map.get(bucket.date);
      if (day) day.deployments = bucket.deployments;
    }

    const series = [...map.values()].map((bucket) => ({
      date: bucket.date,
      success: bucket.success,
      failure: bucket.failure,
      avgDurationMs: bucket.avgDurationMs,
      deployments: bucket.deployments,
    }));

    const decided = successfulRuns + failedRuns;
    const successRate = decided === 0 ? 0 : successfulRuns / decided;
    const avgBuildDurationMs = durationAgg._avg.durationMs
      ? Math.round(durationAgg._avg.durationMs)
      : 0;
    const deploymentSuccessRate =
      totalDeployments === 0 ? 0 : successfulDeployments / totalDeployments;

    res.json({
      projectId: project.id,
      successRate,
      avgBuildDurationMs,
      deploymentSuccessRate,
      totalRuns,
      failedRuns,
      totalDeployments,
      series,
    });
  } catch (err) {
    next(err);
  }
});
