import { Router } from "express";
import { encryptSecret } from "../crypto.js";
import { GitHubApiError } from "../github.js";
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
    const { userId, owner, repo, githubToken, name } = req.body ?? {};
    if (!userId || !owner || !repo || !githubToken) {
      return res.status(400).json({
        error: "userId, owner, repo, and githubToken are required",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const project = await prisma.project.create({
      data: {
        userId,
        owner,
        repo,
        name: name || `${owner}/${repo}`,
        githubTokenEnc: encryptSecret(githubToken),
      },
    });

    res.status(201).json(publicProject(project));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "project already registered for that owner/repo" });
    }
    next(err);
  }
});

projectsRouter.get("/", async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(projects.map(publicProject));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) return res.status(404).json({ error: "project not found" });
    res.json(publicProject(project));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/sync", async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    if (!project) return res.status(404).json({ error: "project not found" });

    const includeJobs = req.body?.includeJobs !== false;
    const maxRuns = parsePositiveInt(req.body?.maxRuns, 20, { min: 1, max: 50 });

    const result = await syncProjectFromGitHub(project, { includeJobs, maxRuns });
    res.json(jsonSafe(result));
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return res.status(err.status === 401 || err.status === 403 ? 502 : 502).json({
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
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
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
    const run = await prisma.pipelineRun.findFirst({
      where: { id: req.params.runId, projectId: req.params.id },
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
