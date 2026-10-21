import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("META_TOKEN_ENCRYPTION_KEY is not configured");
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("META_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes");
  return key;
}

export function encryptInstagramToken(token: string): string {
  if (!token) throw new Error("Cannot encrypt an empty Instagram access token");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptInstagramToken(value: string): string {
  const [version, ivPart, tagPart, dataPart] = value.split(":");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("Unsupported encrypted Instagram token format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}
