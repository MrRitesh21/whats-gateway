import { createHmac, randomBytes } from "node:crypto";
import { constantTimeEqual } from "@/lib/instagram-comment-dm";

export type InstagramOAuthState = { userId: string; nonce: string; expiresAt: number };

export function createInstagramOAuthState(userId: string, secret: string, expiresAt: number, nonce = randomBytes(32).toString("base64url")): string {
  if (!userId || !secret || !Number.isFinite(expiresAt) || !nonce) throw new Error("Invalid Instagram OAuth state input");
  const payload = Buffer.from(JSON.stringify({ userId, nonce, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyInstagramOAuthState(state: string, cookieValue: string, secret: string, now = Date.now()): InstagramOAuthState | null {
  if (!state || !cookieValue || !secret || !constantTimeEqual(state, cookieValue)) return null;
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !constantTimeEqual(supplied.toString("hex"), expected.toString("hex"))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<InstagramOAuthState>;
    if (typeof value.userId !== "string" || typeof value.nonce !== "string" || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) return null;
    return { userId: value.userId, nonce: value.nonce, expiresAt: value.expiresAt };
  } catch { return null; }
}
