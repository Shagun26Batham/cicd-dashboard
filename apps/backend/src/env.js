function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^(.)\1+$/.test(value) || [
    "changeme",
    "default",
    "development",
    "example",
    "password",
    "secret",
    "yourjwtsecret",
  ].some((placeholder) => normalized === placeholder || normalized.startsWith(placeholder));
}

export function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const errors = [];

  if (!["development", "test", "production"].includes(nodeEnv)) {
    errors.push("NODE_ENV must be development, test, or production");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required");
  }

  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey || !/^[0-9a-fA-F]{64}$/.test(encKey) || new Set(encKey.match(/.{2}/g) ?? []).size < 20) {
    errors.push("ENCRYPTION_KEY must be a non-placeholder 64-character hexadecimal string (32 bytes)");
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length < 32 || isPlaceholder(jwtSecret)) {
    errors.push("JWT_SECRET must be a non-placeholder secret of at least 32 characters");
  }

  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (!frontendOrigin) {
    errors.push("FRONTEND_ORIGIN is required");
  } else {
    try {
      const parsedOrigin = new URL(frontendOrigin);
      if (parsedOrigin.origin !== frontendOrigin) {
        errors.push("FRONTEND_ORIGIN must be a valid origin without a path");
      } else if (isProd && parsedOrigin.protocol !== "https:") {
        errors.push("FRONTEND_ORIGIN must use HTTPS in production");
      }
    } catch {
      errors.push("FRONTEND_ORIGIN must be a valid origin without a path");
    }
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret && (webhookSecret.trim().length < 16 || isPlaceholder(webhookSecret))) {
    errors.push("WEBHOOK_SECRET must be a non-placeholder secret of at least 16 characters when configured");
  }
  if (isProd && (!webhookSecret || webhookSecret.trim().length < 32 || isPlaceholder(webhookSecret))) {
    errors.push("WEBHOOK_SECRET must be a non-placeholder secret of at least 32 characters in production");
  }

  if (process.env.TRUST_PROXY && !["0", "1"].includes(process.env.TRUST_PROXY)) {
    errors.push("TRUST_PROXY must be 0 or 1");
  }

  if (
    process.env.COOKIE_SAME_SITE &&
    !["lax", "strict", "none"].includes(process.env.COOKIE_SAME_SITE.toLowerCase())
  ) {
    errors.push("COOKIE_SAME_SITE must be lax, strict, or none");
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}
