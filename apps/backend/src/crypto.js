import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function encryptionKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = crypto.createDecipheriv(
    ALGO,
    encryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateWebhookSecret() {
  return crypto.randomBytes(24).toString("hex");
}

export function verifyGitHubSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;
  const expectedHash = parts[1];

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const calculatedHash = hmac.digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedHash, "hex");
    const calculatedBuf = Buffer.from(calculatedHash, "hex");
    if (expectedBuf.length !== calculatedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
  } catch {
    return false;
  }
}
