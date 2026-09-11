import express from "express";
import cors from "cors";
import { projectsRouter } from "./routes/projects.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cicd-dashboard-backend" });
  });

  app.use("/api/users", usersRouter);
  app.use("/api/projects", projectsRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
