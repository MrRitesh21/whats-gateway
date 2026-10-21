import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/instagram-comment-dm";
import { matchesChannelRule, parseWhatsAppCloudMessages, readWhatsAppCloudConfig, redactMetaError, verifyMetaSignature } from "@/lib/channel-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 1_000_000;

export async function GET(request: NextRequest) {
  const config = readWhatsAppCloudConfig();
  if (!config.verifyToken) return new NextResponse("WhatsApp Cloud webhook is not configured", { status: 503 });
  const params = request.nextUrl.searchParams;
  const challenge = params.get("hub.challenge");
  if (params.get("hub.mode") !== "subscribe" || challenge === null || !constantTimeEqual(params.get("hub.verify_token") || "", config.verifyToken)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  const config = readWhatsAppCloudConfig();
  if (!config.configured) return NextResponse.json({ error: "WhatsApp Cloud API is not configured" }, { status: 503 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return NextResponse.json({ error: "Invalid Meta webhook signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    for (const inbound of parseWhatsAppCloudMessages(payload)) {
      if (inbound.phoneNumberId !== config.phoneNumberId) continue;
      await processInbound(inbound, config);
    }
  } catch (error) {
    console.error("WhatsApp Cloud webhook processing failed:", redactMetaError(error instanceof Error ? error.message : "Unknown error"));
    return NextResponse.json({ error: "Temporary webhook processing failure" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function processInbound(inbound: ReturnType<typeof parseWhatsAppCloudMessages>[number], config: ReturnType<typeof readWhatsAppCloudConfig>) {
  let isNew = true;
  try {
    await prisma.whatsAppCloudEvent.create({
      data: { messageId: inbound.messageId, phoneNumberId: inbound.phoneNumberId, sender: inbound.sender, messageText: inbound.text, status: "processing" },
    });
  } catch (error) {
    if (isUniqueViolation(error)) isNew = false;
    else throw error;
  }
  if (!isNew) return;
  const rules = await prisma.channelAutoReplyRule.findMany({ where: { channel: "WHATSAPP_CLOUD", isActive: true }, orderBy: { createdAt: "asc" } });
  const rule = rules.find((candidate) => matchesChannelRule(inbound.text, candidate));
  if (!rule) {
    await prisma.whatsAppCloudEvent.update({ where: { messageId: inbound.messageId }, data: { status: "ignored", processedAt: new Date() } });
    return;
  }
  try {
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: inbound.sender, type: "text", text: { preview_url: true, body: rule.response } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const result = await response.json().catch(() => ({})) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
    const messageId = result.messages?.[0]?.id;
    if (!response.ok || !messageId) throw new Error(`WhatsApp Cloud API ${response.status}: ${result.error?.message || "message acceptance not confirmed"}`);
    await prisma.whatsAppCloudEvent.update({ where: { messageId: inbound.messageId }, data: { matchedKeyword: rule.keyword, status: "sent", responseMessageId: messageId, processedAt: new Date(), errorMessage: null } });
  } catch (error) {
    const errorMessage = redactMetaError(error instanceof Error ? error.message : "Unknown WhatsApp Cloud error");
    await prisma.whatsAppCloudEvent.update({ where: { messageId: inbound.messageId }, data: { matchedKeyword: rule.keyword, status: "failed", processedAt: new Date(), errorMessage } });
    console.error("WhatsApp Cloud auto-reply failed:", { messageId: inbound.messageId, error: errorMessage });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
