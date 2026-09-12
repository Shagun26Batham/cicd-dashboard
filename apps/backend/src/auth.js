import jwt from "jsonwebtoken";

export const COOKIE_NAME = "cid_session";
const ROLE = "user";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (16+ characters)");
  }
  return secret;
}

export function signUserToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: ROLE }, jwtSecret(), {
    expiresIn: "7d",
  });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, jwtSecret());
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || ROLE,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
