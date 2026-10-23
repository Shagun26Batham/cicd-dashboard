import { Router } from "express";
import bcrypt from "bcryptjs";
import { clearAuthCookie, requireAuth, setAuthCookie, signUserToken } from "../auth.js";
import { prisma } from "../prisma.js";
import { createRateLimiter } from "../rateLimit.js";

export const authRouter = Router();

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again in 15 minutes",
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many registration attempts, please try again in 1 hour",
});

// Minimal email sanity check: requires local@domain.tld format
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user.id, email: user.email, role: "user", createdAt: user.createdAt };
}

authRouter.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (!EMAIL_RE.test(String(email))) {
      return res.status(400).json({ error: "invalid email address" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "email already registered" });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });

    const token = signUserToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ token, ...publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const token = signUserToken(user);
    setAuthCookie(res, token);
    res.json({ token, ...publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, createdAt: true },
    });
    if (!user) return res.status(401).json({ error: "unauthorized" });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});
