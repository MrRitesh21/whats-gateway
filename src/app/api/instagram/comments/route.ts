import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPERADMIN") return NextResponse.json({ status: false, message: "Forbidden" }, { status: 403 });

  const accountId = process.env.INSTAGRAM_ACCOUNT_ID?.trim();
  if (!accountId) return NextResponse.json({ status: false, message: "Instagram account is not configured" }, { status: 503 });

  const events = await prisma.instagramCommentEvent.findMany({
    where: { instagramAccountId: accountId },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      commentId: true,
      username: true,
      commentText: true,
      mediaId: true,
      matchedKeyword: true,
      status: true,
      dmMessageId: true,
      errorMessage: true,
      receivedAt: true,
      processedAt: true,
    },
  });

  return NextResponse.json({ status: true, data: { comments: events } }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
