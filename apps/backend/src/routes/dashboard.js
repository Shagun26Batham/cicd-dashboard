import { Router } from "express";
import { prisma } from "../prisma.js";
import { jsonSafe } from "../serialize.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        owner: true,
        repo: true,
        createdAt: true,
      },
    });

    const projectIds = projects.map((p) => p.id);
    const runWhere = { projectId: { in: projectIds } };

    const [totalBuilds, failedBuilds, successfulBuilds, recentRuns] = await Promise.all([
      prisma.pipelineRun.count({ where: runWhere }),
      prisma.pipelineRun.count({
        where: { ...runWhere, conclusion: "failure" },
      }),
      prisma.pipelineRun.count({
        where: { ...runWhere, conclusion: "success" },
      }),
      prisma.pipelineRun.findMany({
        where: runWhere,
        orderBy: { startedAt: "desc" },
        take: 15,
        include: {
          project: { select: { id: true, name: true, owner: true, repo: true } },
        },
      }),
    ]);

    const decided = successfulBuilds + failedBuilds;
    const successRate = decided === 0 ? 0 : successfulBuilds / decided;

    res.json(
      jsonSafe({
        projects: projects.length,
        totalBuilds,
        failedBuilds,
        successfulBuilds,
        successRate,
        projectList: projects,
        recentRuns,
      }),
    );
  } catch (err) {
    next(err);
  }
});
