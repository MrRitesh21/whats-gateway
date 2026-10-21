import { createHmac, timingSafeEqual } from "node:crypto";

export type ChannelRule = { id: string; keyword: string; matchType: string; response: string };

export function findMatchingChannelKeyword(text: string, rule: Pick<ChannelRule, "keyword" | "matchType">): string | null {
  const source = text.normalize("NFKC");
  const matchType = rule.matchType.toUpperCase();
  const primary = rule.keyword.normalize("NFKC").trim();
  if (!primary) return null;
  const variants = matchType === "REGEX" ? [primary] : primary.split(/[,\n]/).map((term) => term.normalize("NFKC").trim()).filter(Boolean);
  for (const variant of variants) {
    switch (matchType) {
      case "EXACT":
        if (source.toLowerCase() === variant.toLowerCase()) return variant;
        break;
      case "STARTS_WITH":
        if (source.toLowerCase().startsWith(variant.toLowerCase())) return variant;
        break;
      case "REGEX":
        try { if (new RegExp(variant, "iu").test(source)) return variant; } catch { /* invalid regex does not match */ }
        break;
      case "CONTAINS":
      default:
        if (source.toLowerCase().includes(variant.toLowerCase())) return variant;
    }
  }
  return null;
}

export function matchesChannelRule(text: string, rule: Pick<ChannelRule, "keyword" | "matchType">): boolean {
  return findMatchingChannelKeyword(text, rule) !== null;
}

export function verifyMetaSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type WhatsAppCloudInbound = { phoneNumberId: string; messageId: string; sender: string; text: string };

export function parseWhatsAppCloudMessages(payload: unknown): WhatsAppCloudInbound[] {
  if (!record(payload) || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return [];
  const messages: WhatsAppCloudInbound[] = [];
  for (const entry of payload.entry) {
    if (!record(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!record(change) || change.field !== "messages" || !record(change.value)) continue;
      const value = change.value;
      const metadata = record(value.metadata) ? value.metadata : null;
      if (!metadata || typeof metadata.phone_number_id !== "string" || !Array.isArray(value.messages)) continue;
      for (const message of value.messages) {
        if (!record(message) || message.type !== "text" || !record(message.text)) continue;
        if (typeof message.id !== "string" || typeof message.from !== "string" || typeof message.text.body !== "string") continue;
        messages.push({ phoneNumberId: metadata.phone_number_id, messageId: message.id, sender: message.from, text: message.text.body.slice(0, 10_000) });
      }
    }
  }
  return messages;
}

export function readWhatsAppCloudConfig() {
  const enabled = process.env.WHATSAPP_CLOUD_API_ENABLED?.trim().toLowerCase() === "true";
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() || "";
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() || "";
  const verifyToken = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN?.trim() || process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || "";
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  return { enabled, token, phoneNumberId, verifyToken, appSecret, graphVersion,
    configured: enabled && !!token && !!phoneNumberId && !!verifyToken && !!appSecret && /^v\d+\.\d+$/.test(graphVersion) };
}

export function redactMetaError(message: string): string {
  return message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/access_token[=:'"\s]+[^&\s'"}]+/gi, "access_token=[REDACTED]").slice(0, 800);
}

function record(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
