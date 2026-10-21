import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.authMethod !== "session") return NextResponse.json({ error: "Please sign in with your dashboard session first" }, { status: 401 });
  const connection = await prisma.instagramAccountConnection.findUnique({ where: { userId: user.id }, select: { username: true, instagramUserId: true, tokenExpiresAt: true, grantedScopes: true, webhookSubscribed: true, connectedAt: true } });
  const connectReady = !!(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim() && process.env.META_TOKEN_ENCRYPTION_KEY?.trim() && process.env.META_APP_SECRET?.trim() && process.env.META_WEBHOOK_VERIFY_TOKEN?.trim());
  return NextResponse.json({ connection, connectReady }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.authMethod !== "session") return NextResponse.json({ error: "Please sign in with your dashboard session first" }, { status: 401 });
  if (user.role === "STAFF") return NextResponse.json({ error: "Only account owners can disconnect Instagram" }, { status: 403 });
  await prisma.instagramAccountConnection.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ disconnected: true });
}
