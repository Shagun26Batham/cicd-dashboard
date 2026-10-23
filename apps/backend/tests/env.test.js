import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateEnv } from "../src/env.js";

const requiredEnv = [
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "JWT_SECRET",
  "FRONTEND_ORIGIN",
  "WEBHOOK_SECRET",
  "NODE_ENV",
  "TRUST_PROXY",
];

test("environment validation accepts explicitly configured production secrets", () => {
  const original = Object.fromEntries(requiredEnv.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://user:password@localhost:5432/test",
    ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    FRONTEND_ORIGIN: "https://dashboard.example.com",
    WEBHOOK_SECRET: crypto.randomBytes(32).toString("hex"),
    NODE_ENV: "production",
    TRUST_PROXY: "1",
  });

  try {
    assert.doesNotThrow(validateEnv);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("environment validation rejects missing, weak, and malformed configuration without echoing values", () => {
  const original = Object.fromEntries(requiredEnv.map((key) => [key, process.env[key]]));
  const weakJwtSecret = "change-me-this-is-a-long-but-insecure-placeholder";
  Object.assign(process.env, {
    DATABASE_URL: "",
    ENCRYPTION_KEY: "0123456789abcdef".repeat(4),
    JWT_SECRET: weakJwtSecret,
    FRONTEND_ORIGIN: "https://dashboard.example.com/path",
    WEBHOOK_SECRET: "short",
    NODE_ENV: "production",
    TRUST_PROXY: "true",
  });

  try {
    assert.throws(validateEnv, (error) => {
      assert.match(error.message, /DATABASE_URL is required/);
      assert.match(error.message, /ENCRYPTION_KEY/);
      assert.match(error.message, /JWT_SECRET/);
      assert.match(error.message, /WEBHOOK_SECRET/);
      assert.match(error.message, /FRONTEND_ORIGIN/);
      assert.match(error.message, /TRUST_PROXY/);
      assert.equal(error.message.includes(weakJwtSecret), false);
      return true;
    });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
