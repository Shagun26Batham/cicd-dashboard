import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requireAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { metricsRouter } from "./routes/metrics.js";
import { projectsRouter } from "./routes/projects.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cicd-dashboard-backend" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/metrics", requireAuth, metricsRouter);
  app.use("/api/projects", requireAuth, projectsRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
