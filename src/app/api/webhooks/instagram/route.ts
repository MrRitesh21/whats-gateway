import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMatchingChannelKeyword } from "@/lib/channel-automation";
import { decryptInstagramToken } from "@/lib/instagram-token-crypto";
import {
  findInstagramKeyword,
  parseInstagramCommentEvents,
  readInstagramWebhookConfig,
  redactInstagramError,
  verifyInstagramWebhookSignature,
  constantTimeEqual,
  type InstagramWebhookConfig,
} from "@/lib/instagram-comment-dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_WEBHOOK_BYTES = 1_000_000;

export async function GET(request: NextRequest) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!verifyToken) return new NextResponse("Webhook verification is not configured", { status: 503 });
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const suppliedToken = params.get("hub.verify_token") || "";
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !constantTimeEqual(suppliedToken, verifyToken) || challenge === null) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  let config: InstagramWebhookConfig;
  try {
    config = readInstagramWebhookConfig();
  } catch (error) {
    console.error("Instagram comment automation configuration error:", redactInstagramError(error instanceof Error ? error.message : "Unknown error"));
    return NextResponse.json({ error: "Instagram webhook is not configured" }, { status: 503 });
  }

  if (!verifyInstagramWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return NextResponse.json({ error: "Invalid Meta webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const commentEvents = parseInstagramCommentEvents(payload);
  try {
    for (const event of commentEvents) {
      const connection = await prisma.instagramAccountConnection.findUnique({ where: { instagramUserId: event.instagramAccountId } });
      const legacyMatch = !connection && config.legacyAccountId === event.instagramAccountId && !!config.legacyAccessToken;
      if (!connection && !legacyMatch) continue;
      const accessToken = connection ? decryptInstagramToken(connection.encryptedAccessToken) : config.legacyAccessToken!;
      await captureAndReply(event, config, { userId: connection?.userId ?? null, accessToken });
    }
  } catch (error) {
    console.error("Instagram comment webhook failed:", redactInstagramError(error instanceof Error ? error.message : "Unknown error"));
    return NextResponse.json({ error: "Temporary webhook processing failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function captureAndReply(value: ReturnType<typeof parseInstagramCommentEvents>[number], config: InstagramWebhookConfig, account: { userId: string | null; accessToken: string }) {
  const { commentId, commentText, instagramAccountId } = value;
  const rules = await prisma.channelAutoReplyRule.findMany({ where: { channel: "INSTAGRAM", userId: account.userId }, orderBy: { createdAt: "asc" } });
  const matchingRule = rules.find((rule) => rule.isActive && findMatchingChannelKeyword(commentText, rule) !== null);
  const matchedVariant = matchingRule ? findMatchingChannelKeyword(commentText, matchingRule) : null;
  // Keep the original environment-based rule as a compatibility fallback only for its exact legacy account.
  const matchedKeyword = matchedVariant || (account.userId === null && rules.length === 0 ? findInstagramKeyword(commentText, config.keywords) : null);
  let isNew = true;

  // Claim the unique comment ID durably before making the external API call. Meta
  // retries and concurrent duplicate deliveries can never send a second reply.
  try {
    await prisma.instagramCommentEvent.create({
      data: {
        commentId,
        instagramAccountId,
        username: value.username?.slice(0, 255) || null,
        commenterId: value.commenterId,
        commentText,
        mediaId: value.mediaId,
        matchedKeyword,
        status: matchedKeyword ? "processing" : "ignored",
        processedAt: matchedKeyword ? null : new Date(),
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) isNew = false;
    else throw error;
  }
  if (!isNew || !matchedKeyword) return;

  try {
    const replyText = matchingRule?.response || (account.userId === null ? [config.dmMessage, config.dmLink].filter(Boolean).join("\n") : "");
    if (!replyText) throw new Error("Add an Instagram auto-reply rule before enabling private replies");

    const response = await fetch(`https://graph.instagram.com/${config.graphVersion}/${encodeURIComponent(instagramAccountId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: replyText } }),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as { message_id?: string; error?: { message?: string } };
    if (!response.ok || !result.message_id) {
      throw new Error(`Instagram API ${response.status}: ${result.error?.message || "private reply not confirmed"}`);
    }

    await prisma.instagramCommentEvent.update({
      where: { commentId },
      data: { status: "sent", dmMessageId: result.message_id, processedAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    const errorMessage = redactInstagramError(error instanceof Error ? error.message : "Unknown Instagram API error");
    await prisma.instagramCommentEvent.update({
      where: { commentId },
      data: { status: "failed", processedAt: new Date(), errorMessage },
    });
    // Do not retry: network errors can happen after Meta accepted the message,
    // so automatic retries could deliver a duplicate private reply.
    console.error("Instagram private reply failed:", { commentId, error: errorMessage });
  }
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
