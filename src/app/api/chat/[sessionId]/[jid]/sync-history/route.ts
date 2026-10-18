import { prisma } from "@/lib/prisma";
import { normalizeJid } from "@/lib/jid-utils";
import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { logger } from "@/lib/logger";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    const { sessionId, jid } = await params;
    const decodedJid = decodeURIComponent(jid);

    try {
        const internalSecret = request.headers.get("x-internal-secret");
        const isInternalAuth = internalSecret && process.env.AUTH_SECRET && internalSecret === process.env.AUTH_SECRET;

        if (!isInternalAuth) {
            const user = await getAuthenticatedUser(request);
            if (!user) {
                return NextResponse.json({ status: false, error: "Unauthorized" }, { status: 401 });
            }
            const canAccess = await canAccessSession(user.id, user.role, sessionId);
            if (!canAccess) {
                return NextResponse.json({ status: false, error: "Forbidden" }, { status: 403 });
            }
        }

        const sessionRecord = await prisma.session.findFirst({
            where: {
                OR: [
                    { id: sessionId },
                    { sessionId: sessionId },
                    { name: sessionId }
                ]
            },
            select: { id: true, sessionId: true, status: true, name: true }
        });

        if (!sessionRecord) {
            return NextResponse.json({ status: false, error: "Session not found" }, { status: 404 });
        }

        const instance = waManager.getInstance(sessionRecord.sessionId) || waManager.getInstance(sessionId) || waManager.getInstance(sessionRecord.id);
        if (!instance || !instance.socket) {
            return NextResponse.json({
                status: false,
                error: `WhatsApp session is not active on this host (Status: ${instance?.status || sessionRecord.status})`
            }, { status: 400 });
        }

        const normalizedJid = normalizeJid(decodedJid);
        const oldestMessage = await prisma.message.findFirst({
            where: {
                sessionId: sessionRecord.id,
                OR: [
                    { remoteJid: decodedJid },
                    { remoteJid: normalizedJid }
                ]
            },
            orderBy: { timestamp: "asc" },
            select: { keyId: true, fromMe: true, timestamp: true }
        });

        const oldestKey = oldestMessage ? {
            remoteJid: decodedJid,
            fromMe: oldestMessage.fromMe,
            id: oldestMessage.keyId
        } : {
            remoteJid: decodedJid,
            fromMe: false,
            id: "0"
        };

        const oldestTimestampMs = oldestMessage
            ? oldestMessage.timestamp.getTime()
            : Date.now();

        logger.info("ChatAPI", `Requesting message history for ${decodedJid} from WhatsApp phone...`);
        await instance.socket.fetchMessageHistory(50, oldestKey as any, oldestTimestampMs);

        return NextResponse.json({ status: true, message: "History fetch request sent to WhatsApp phone" });
    } catch (err: any) {
        logger.error("ChatAPI", "Error syncing chat history:", err);
        return NextResponse.json({ status: false, error: err.message }, { status: 500 });
    }
}
