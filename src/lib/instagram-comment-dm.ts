import { createHmac, timingSafeEqual } from "node:crypto";

export type InstagramWebhookCommentEvent = {
  instagramAccountId: string;
  commentId: string;
  commentText: string;
  commenterId: string;
  username?: string;
  mediaId: string;
};

export function parseInstagramCommentEvents(payload: unknown): InstagramWebhookCommentEvent[] {
  if (!isRecord(payload) || payload.object !== "instagram" || !Array.isArray(payload.entry)) return [];
  const events: InstagramWebhookCommentEvent[] = [];
  for (const rawEntry of payload.entry) {
    if (!isRecord(rawEntry) || typeof rawEntry.id !== "string" || !Array.isArray(rawEntry.changes)) continue;
    for (const rawChange of rawEntry.changes) {
      if (!isRecord(rawChange) || rawChange.field !== "comments" || !isRecord(rawChange.value)) continue;
      const value = rawChange.value;
      const from = isRecord(value.from) ? value.from : null;
      const media = isRecord(value.media) ? value.media : null;
      const commentId = asNonEmptyString(value.id) || asNonEmptyString(value.comment_id);
      const commenterId = asNonEmptyString(from?.id);
      const mediaId = asNonEmptyString(media?.id) || asNonEmptyString(value.media_id);
      if (!commentId || !commenterId || !mediaId || commenterId === rawEntry.id) continue;
      events.push({
        instagramAccountId: rawEntry.id,
        commentId,
        commentText: typeof value.text === "string" ? value.text.slice(0, 10_000) : "",
        commenterId,
        username: asNonEmptyString(from?.username) || undefined,
        mediaId,
      });
    }
  }
  return events;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type InstagramCommentConfig = {
  appSecret: string;
  verifyToken: string;
  accountId: string;
  accessToken: string;
  keywords: string[];
  dmMessage: string;
  dmLink: string;
  graphVersion: string;
};

export function readInstagramConfig(): InstagramCommentConfig {
  const appSecret = requiredEnv("META_APP_SECRET");
  const verifyToken = requiredEnv("META_WEBHOOK_VERIFY_TOKEN");
  const accountId = requiredEnv("INSTAGRAM_ACCOUNT_ID");
  const accessToken = requiredEnv("INSTAGRAM_ACCESS_TOKEN");
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error("META_GRAPH_API_VERSION must look like v25.0");

  return {
    appSecret,
    verifyToken,
    accountId,
    accessToken,
    keywords: (process.env.IG_COMMENT_KEYWORDS || "")
      .split(",")
      .map((keyword) => keyword.normalize("NFKC").trim())
      .filter(Boolean),
    dmMessage: process.env.IG_DM_MESSAGE?.trim() || "",
    dmLink: process.env.IG_DM_LINK?.trim() || "",
    graphVersion,
  };
}

export type InstagramWebhookConfig = {
  appSecret: string;
  verifyToken: string;
  legacyAccountId: string | null;
  legacyAccessToken: string | null;
  keywords: string[];
  dmMessage: string;
  dmLink: string;
  graphVersion: string;
};

/** Webhook verification must work for OAuth-connected accounts without deployment-wide tokens. */
export function readInstagramWebhookConfig(): InstagramWebhookConfig {
  const appSecret = requiredEnv("META_APP_SECRET");
  const verifyToken = requiredEnv("META_WEBHOOK_VERIFY_TOKEN");
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error("META_GRAPH_API_VERSION must look like v25.0");
  return {
    appSecret,
    verifyToken,
    legacyAccountId: process.env.INSTAGRAM_ACCOUNT_ID?.trim() || null,
    legacyAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null,
    keywords: (process.env.IG_COMMENT_KEYWORDS || "").split(",").map((keyword) => keyword.normalize("NFKC").trim()).filter(Boolean),
    dmMessage: process.env.IG_DM_MESSAGE?.trim() || "",
    dmLink: process.env.IG_DM_LINK?.trim() || "",
    graphVersion,
  };
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function verifyInstagramWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(header.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Match whole words/phrases case-insensitively, without matching inside a longer word. */
export function findInstagramKeyword(text: string, keywords: string[]): string | null {
  const normalized = text.normalize("NFKC");
  for (const original of keywords) {
    const phrase = original.normalize("NFKC").trim();
    if (!phrase) continue;
    const expression = phrase.split(/\s+/).map(escapeRegExp).join("\\s+");
    const boundaryPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}_])(${expression})(?=$|[^\\p{L}\\p{N}_])`, "iu");
    if (boundaryPattern.test(normalized)) return original;
  }
  return null;
}

export function redactInstagramError(message: string): string {
  return message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/access_token[=:'"\s]+[^&\s'"}]+/gi, "access_token=[REDACTED]").slice(0, 1000);
}

function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing environment variable ${key}`);
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
