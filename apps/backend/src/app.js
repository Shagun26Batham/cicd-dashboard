import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requireAuth } from "./auth.js";
import { prisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { eventsRouter } from "./routes/events.js";
import { metricsRouter } from "./routes/metrics.js";
import { projectsRouter } from "./routes/projects.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);

  const origin = process.env.FRONTEND_ORIGIN;
  if (!origin) {
    throw new Error("FRONTEND_ORIGIN environment variable is required");
  }

  app.use(cors({ origin, credentials: true }));

  // IMPORTANT: mount express.raw({type:'application/json'}) on webhooks route BEFORE
  // the global express.json() parser, since HMAC verification needs the raw byte body.
  app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

  // Global JSON parser for all standard API routes
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "cicd-dashboard-backend", database: "connected" });
    } catch (err) {
      console.error("Database health check failed", { code: err.code });
      res.status(503).json({
        ok: false,
        service: "cicd-dashboard-backend",
        database: "disconnected",
        error: "database unavailable",
      });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/metrics", requireAuth, metricsRouter);
  app.use("/api/projects", requireAuth, projectsRouter);

  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
      return res.status(400).json({ error: "invalid JSON body" });
    }
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
