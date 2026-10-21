import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";

export const runtime = "nodejs";
const CHANNELS = new Set(["INSTAGRAM", "WHATSAPP_CLOUD"]);
const MATCH_TYPES = new Set(["EXACT", "CONTAINS", "STARTS_WITH", "REGEX"]);

async function admin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  return user?.role === "SUPERADMIN" ? user : null;
}

export async function GET(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const channel = request.nextUrl.searchParams.get("channel") || "";
  if (!CHANNELS.has(channel)) return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  const rules = await prisma.channelAutoReplyRule.findMany({ where: { channel }, orderBy: { createdAt: "desc" } });
  const configured = channel === "INSTAGRAM"
    ? !!(process.env.META_APP_SECRET?.trim() && process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() && process.env.INSTAGRAM_ACCOUNT_ID?.trim() && process.env.INSTAGRAM_ACCESS_TOKEN?.trim())
    : (await import("@/lib/channel-automation")).readWhatsAppCloudConfig().configured;
  return NextResponse.json({ rules, configured, webhookPath: channel === "INSTAGRAM" ? "/api/webhooks/instagram" : "/api/webhooks/whatsapp-cloud" });
}

export async function POST(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !CHANNELS.has(body.channel) || typeof body.keyword !== "string" || typeof body.response !== "string") {
    return NextResponse.json({ error: "Channel, keyword and response are required" }, { status: 400 });
  }
  const keyword = body.keyword.trim();
  const response = body.response.trim();
  const matchType = typeof body.matchType === "string" ? body.matchType.toUpperCase() : "CONTAINS";
  const maxResponseLength = body.channel === "INSTAGRAM" ? 1000 : 4000;
  if (!keyword || !response || keyword.length > 300 || response.length > maxResponseLength || !MATCH_TYPES.has(matchType)) {
    return NextResponse.json({ error: "Invalid keyword, response or match type" }, { status: 400 });
  }
  const rule = await prisma.channelAutoReplyRule.create({ data: { channel: body.channel, keyword, matchType, response } });
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  const existing = await prisma.channelAutoReplyRule.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  const data: { keyword?: string; response?: string; matchType?: string; isActive?: boolean } = {};
  if (typeof body.keyword === "string") data.keyword = body.keyword.trim();
  if (typeof body.response === "string") data.response = body.response.trim();
  if (typeof body.matchType === "string") data.matchType = body.matchType.toUpperCase();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  const maxResponseLength = existing.channel === "INSTAGRAM" ? 1000 : 4000;
  if ((data.keyword !== undefined && (!data.keyword || data.keyword.length > 300)) || (data.response !== undefined && (!data.response || data.response.length > maxResponseLength)) || (data.matchType !== undefined && !MATCH_TYPES.has(data.matchType))) {
    return NextResponse.json({ error: "Invalid rule values" }, { status: 400 });
  }
  const rule = await prisma.channelAutoReplyRule.update({ where: { id: body.id }, data });
  return NextResponse.json({ rule });
}

export async function DELETE(request: NextRequest) {
  if (!(await admin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  const existing = await prisma.channelAutoReplyRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  await prisma.channelAutoReplyRule.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
