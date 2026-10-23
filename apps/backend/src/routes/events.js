import { Router } from "express";
import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "../auth.js";
import { eventBus } from "../eventBus.js";
import { prisma } from "../prisma.js";

export const eventsRouter = Router();

function authenticateEventRequest(req) {
  const authHeader = req.headers?.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = req.cookies?.[COOKIE_NAME] || req.query?.token || bearerToken;
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

eventsRouter.get("/", async (req, res) => {
  const user = authenticateEventRequest(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const userId = user.sub || user.id;
  const userProjects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });
  const ownedProjectIds = new Set(userProjects.map((p) => p.id));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering
  res.flushHeaders?.();

  // Send initial handshake with recent events scoped to user's projects
  const initialEvents = eventBus
    .getRecent(50)
    .filter((e) => e.projectId && ownedProjectIds.has(e.projectId))
    .slice(0, 10);

  res.write(
    `event: handshake\ndata: ${JSON.stringify({
      type: "handshake",
      events: initialEvents,
    })}\n\n`,
  );
  // Also as generic message event
  res.write(
    `event: message\ndata: ${JSON.stringify({
      type: "handshake",
      events: initialEvents,
    })}\n\n`,
  );

  const onEvent = async (event) => {
    if (!event.projectId) return;
    if (!ownedProjectIds.has(event.projectId)) {
      // Dynamic check for projects registered after SSE connection opened
      const owned = await prisma.project.findFirst({
        where: { id: event.projectId, userId },
        select: { id: true },
      });
      if (!owned) return;
      ownedProjectIds.add(event.projectId);
    }

    const eventName = event.eventName || "message";
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`);
    if (eventName !== "message") {
      res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
    }
  };

  eventBus.on("pipeline_event", onEvent);

  // Heartbeat every 20s
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20000);

  // Handle client disconnect cleanup
  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.off("pipeline_event", onEvent);
    res.end();
  });
});

eventsRouter.get("/recent", async (req, res) => {
  const user = authenticateEventRequest(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const userId = user.sub || user.id;
  const userProjects = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
  });
  const ownedProjectIds = new Set(userProjects.map((p) => p.id));

  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const events = eventBus
    .getRecent(100)
    .filter((e) => e.projectId && ownedProjectIds.has(e.projectId))
    .slice(0, limit);

  res.json({ events });
});
