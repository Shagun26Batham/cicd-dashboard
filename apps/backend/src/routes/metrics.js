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
      other: 0,
      durationSum: 0,
      durationCount: 0,
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
    const [runs, deployments, allRuns, allDeployments] = await Promise.all([
      prisma.pipelineRun.findMany({
        where: { projectId: project.id, startedAt: { gte: since } },
        select: { startedAt: true, conclusion: true, durationMs: true },
      }),
      prisma.deployment.findMany({
        where: { projectId: project.id, timestamp: { gte: since } },
        select: { timestamp: true, status: true },
      }),
      prisma.pipelineRun.findMany({
        where: { projectId: project.id },
        select: { conclusion: true, durationMs: true },
      }),
      prisma.deployment.findMany({
        where: { projectId: project.id },
        select: { status: true },
      }),
    ]);

    const map = new Map(emptyBuckets(days).map((b) => [b.date, b]));

    for (const run of runs) {
      if (!run.startedAt) continue;
      const key = isoDate(run.startedAt);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (run.conclusion === "success") bucket.success += 1;
      else if (run.conclusion === "failure") bucket.failure += 1;
      else bucket.other += 1;
      if (typeof run.durationMs === "number") {
        bucket.durationSum += run.durationMs;
        bucket.durationCount += 1;
      }
    }

    for (const dep of deployments) {
      const key = isoDate(dep.timestamp);
      const bucket = map.get(key);
      if (bucket) bucket.deployments += 1;
    }

    const series = [...map.values()].map((b) => ({
      date: b.date,
      success: b.success,
      failure: b.failure,
      avgDurationMs: b.durationCount ? Math.round(b.durationSum / b.durationCount) : 0,
      deployments: b.deployments,
    }));

    const successful = allRuns.filter((r) => r.conclusion === "success").length;
    const failed = allRuns.filter((r) => r.conclusion === "failure").length;
    const decided = successful + failed;
    const durations = allRuns
      .map((r) => r.durationMs)
      .filter((n) => typeof n === "number" && n >= 0);
    const deployOk = allDeployments.filter((d) =>
      ["success", "completed"].includes(String(d.status).toLowerCase()),
    ).length;

    res.json({
      projectId: project.id,
      successRate: decided === 0 ? 0 : successful / decided,
      avgBuildDurationMs: durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      deploymentSuccessRate:
        allDeployments.length === 0 ? 0 : deployOk / allDeployments.length,
      totalRuns: allRuns.length,
      failedRuns: failed,
      totalDeployments: allDeployments.length,
      series,
    });
  } catch (err) {
    next(err);
  }
});
