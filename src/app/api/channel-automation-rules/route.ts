import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { readWhatsAppCloudConfig } from "@/lib/channel-automation";

export const runtime = "nodejs";
const CHANNELS = new Set(["INSTAGRAM", "WHATSAPP_CLOUD"]);
const MATCH_TYPES = new Set(["EXACT", "CONTAINS", "STARTS_WITH", "REGEX"]);

type User = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
async function getUser(request: NextRequest) { return getAuthenticatedUser(request); }
function canManageCloud(user: User) { return user.role === "SUPERADMIN"; }

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const channel = request.nextUrl.searchParams.get("channel") || "";
  if (!CHANNELS.has(channel)) return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  if (channel === "WHATSAPP_CLOUD" && !canManageCloud(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = channel === "INSTAGRAM" ? { channel, userId: user.id } : { channel, userId: null };
  const [rules, connection] = await Promise.all([
    prisma.channelAutoReplyRule.findMany({ where: scope, orderBy: { createdAt: "desc" } }),
    channel === "INSTAGRAM" ? prisma.instagramAccountConnection.findUnique({ where: { userId: user.id }, select: { username: true, instagramUserId: true, tokenExpiresAt: true, grantedScopes: true, webhookSubscribed: true, connectedAt: true } }) : Promise.resolve(null),
  ]);
  const connectReady = !!(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim() && process.env.META_TOKEN_ENCRYPTION_KEY?.trim() && process.env.META_APP_SECRET?.trim() && process.env.META_WEBHOOK_VERIFY_TOKEN?.trim());
  const configured = channel === "INSTAGRAM" ? !!connection : readWhatsAppCloudConfig().configured;
  return NextResponse.json({
    rules,
    configured,
    connection: connection ? { username: connection.username, instagramUserId: connection.instagramUserId, tokenExpiresAt: connection.tokenExpiresAt, grantedScopes: connection.grantedScopes, webhookSubscribed: connection.webhookSubscribed, connectedAt: connection.connectedAt } : null,
    connectReady,
    webhookPath: channel === "INSTAGRAM" ? "/api/webhooks/instagram" : "/api/webhooks/whatsapp-cloud",
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !CHANNELS.has(body.channel) || typeof body.keyword !== "string" || typeof body.response !== "string") return NextResponse.json({ error: "Channel, keyword and response are required" }, { status: 400 });
  if (body.channel === "WHATSAPP_CLOUD" && !canManageCloud(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (body.channel === "INSTAGRAM" && user.role === "STAFF") return NextResponse.json({ error: "Only account owners can manage Instagram automation" }, { status: 403 });
  if (body.channel === "INSTAGRAM" && !(await prisma.instagramAccountConnection.findUnique({ where: { userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Connect your Instagram professional account first" }, { status: 409 });

  const keyword = body.keyword.trim();
  const response = body.response.trim();
  const matchType = typeof body.matchType === "string" ? body.matchType.toUpperCase() : "CONTAINS";
  const maxResponseLength = body.channel === "INSTAGRAM" ? 1000 : 4000;
  if (!keyword || !response || keyword.length > 300 || response.length > maxResponseLength || !MATCH_TYPES.has(matchType)) return NextResponse.json({ error: "Invalid keyword, response or match type" }, { status: 400 });
  const rule = await prisma.channelAutoReplyRule.create({ data: { channel: body.channel, userId: body.channel === "INSTAGRAM" ? user.id : null, keyword, matchType, response } });
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  const existing = await prisma.channelAutoReplyRule.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if ((existing.channel === "WHATSAPP_CLOUD" && (!canManageCloud(user) || existing.userId !== null)) || (existing.channel === "INSTAGRAM" && existing.userId !== user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data: { keyword?: string; response?: string; matchType?: string; isActive?: boolean } = {};
  if (typeof body.keyword === "string") data.keyword = body.keyword.trim();
  if (typeof body.response === "string") data.response = body.response.trim();
  if (typeof body.matchType === "string") data.matchType = body.matchType.toUpperCase();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  const maxResponseLength = existing.channel === "INSTAGRAM" ? 1000 : 4000;
  if ((data.keyword !== undefined && (!data.keyword || data.keyword.length > 300)) || (data.response !== undefined && (!data.response || data.response.length > maxResponseLength)) || (data.matchType !== undefined && !MATCH_TYPES.has(data.matchType))) return NextResponse.json({ error: "Invalid rule values" }, { status: 400 });
  const rule = await prisma.channelAutoReplyRule.update({ where: { id: body.id }, data });
  return NextResponse.json({ rule });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  const existing = await prisma.channelAutoReplyRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if ((existing.channel === "WHATSAPP_CLOUD" && (!canManageCloud(user) || existing.userId !== null)) || (existing.channel === "INSTAGRAM" && existing.userId !== user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.channelAutoReplyRule.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
