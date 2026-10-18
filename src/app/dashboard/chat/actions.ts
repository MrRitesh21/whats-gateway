"use server";

import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { getAuthenticatedUserForAction } from "@/lib/server-action-auth";
import { canAccessSession } from "@/lib/api-auth";

// In-memory cache for mapping Baileys sessionId string to DB Session CUID
const sessionDbIdCache = new Map<string, { id: string; expires: number }>();

async function getDbSessionId(sessionId: string): Promise<string | null> {
    const cached = sessionDbIdCache.get(sessionId);
    if (cached && cached.expires > Date.now()) {
        return cached.id;
    }
    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });
    if (session) {
        sessionDbIdCache.set(sessionId, { id: session.id, expires: Date.now() + 5 * 60 * 1000 });
        return session.id;
    }
    return null;
}

// Timeout helper to guarantee Baileys socket queries never hang
function withTimeout<T>(promise: Promise<T>, ms = 2000, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
}

// Fetch chat list
export async function getChatsStatus(sessionId: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const dbSessionId = await getDbSessionId(sessionId);
    if (!dbSessionId) throw new Error("Session not found");
    
    return await ChatService.getChatsList(dbSessionId);
}

// Fetch messages for a specific chat (blazing fast with selective fields and composite indexes)
export async function getChatMessages(sessionId: string, jid: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const dbSessionId = await getDbSessionId(sessionId);
    if (!dbSessionId) throw new Error("Session not found");

    const messages = await ChatService.getMessages(dbSessionId, jid, 100);

    return messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
    }));
}

// Send a basic text message
export async function sendChatMessage(sessionId: string, jid: string, text: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        const result = await ChatService.sendTextMessage(sessionId, jid, { text });
        return {
            success: true,
            keyId: result?.key?.id || null,
            timestamp: result?.messageTimestamp ? new Date(Number(result.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
        };
    } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

// Upload and Send Media
export async function sendMediaMessage(formData: FormData) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const sessionId = formData.get("sessionId") as string;
    const jid = formData.get("jid") as string;
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const caption = formData.get("caption") as string || "";

    if (!sessionId || !jid || !file || !type) {
        throw new Error("Missing required fields");
    }

    // Check file size limit (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is 50MB.`);
    }

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        
        const result = await ChatService.sendMediaMessage(
            sessionId,
            jid,
            buffer,
            type,
            file.type,
            file.name,
            caption
        );

        return {
            success: true,
            keyId: result?.key?.id || null,
            timestamp: result?.messageTimestamp ? new Date(Number(result.messageTimestamp) * 1000).toISOString() : new Date().toISOString()
        };
    } catch (error: any) {
        console.error("Media send error:", error);
        throw new Error(`Failed to send media: ${error.message}`);
    }
}

// Fetch single contact profile picture with fast timeout
export async function getContactProfilePic(sessionId: string, jid: string): Promise<string | null> {
    try {
        const user = await getAuthenticatedUserForAction();
        if (!user) return null;

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) return null;

        const instance = (await import("@/modules/whatsapp/manager")).waManager.getInstance(sessionId);
        if (!instance?.socket) return null;

        const cleanJid = decodeURIComponent(jid);
        const dbSessionId = await getDbSessionId(sessionId);

        // Check if contact has alternate JID (e.g. LID or Phone JID) or existing profilePic in DB
        let altJid: string | null = null;
        if (dbSessionId) {
            const contact = await prisma.contact.findFirst({
                where: {
                    sessionId: dbSessionId,
                    OR: [{ jid: cleanJid }, { lid: cleanJid }, { remoteJidAlt: cleanJid }]
                },
                select: { jid: true, lid: true, remoteJidAlt: true, profilePic: true }
            });

            if (contact?.profilePic) return contact.profilePic;

            if (contact) {
                if (contact.lid && contact.lid !== cleanJid) altJid = contact.lid;
                else if (contact.remoteJidAlt && contact.remoteJidAlt !== cleanJid) altJid = contact.remoteJidAlt;
                else if (contact.jid && contact.jid !== cleanJid) altJid = contact.jid;
            }
        }

        // Try primary JID with strict 2-second timeout
        let ppUrl: string | null = null;
        try {
            const res = await withTimeout(instance.socket.profilePictureUrl(cleanJid, 'image'), 2000, null);
            ppUrl = res || null;
        } catch {
            if (altJid) {
                try {
                    const res = await withTimeout(instance.socket.profilePictureUrl(altJid, 'image'), 2000, null);
                    ppUrl = res || null;
                } catch {
                    ppUrl = null;
                }
            }
        }

        if (ppUrl && dbSessionId) {
            const jidsToUpdate = [cleanJid];
            if (altJid) jidsToUpdate.push(altJid);
            prisma.contact.updateMany({
                where: { sessionId: dbSessionId, jid: { in: jidsToUpdate } },
                data: { profilePic: ppUrl }
            }).catch(() => {});
        }

        return ppUrl || null;
    } catch {
        return null;
    }
}

// Batch fetch profile pictures for contacts/groups that are missing profilePic
export async function getBatchProfilePictures(sessionId: string, jids: string[]): Promise<Record<string, string>> {
    try {
        const user = await getAuthenticatedUserForAction();
        if (!user) return {};

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) return {};

        const instance = (await import("@/modules/whatsapp/manager")).waManager.getInstance(sessionId);
        if (!instance?.socket) return {};

        const results: Record<string, string> = {};
        const dbSessionId = await getDbSessionId(sessionId);

        // Look up contacts in DB to get any alt JIDs and cached profile pictures
        const contactMap = new Map<string, string>();
        if (dbSessionId) {
            const dbContacts = await prisma.contact.findMany({
                where: { sessionId: dbSessionId, jid: { in: jids } },
                select: { jid: true, lid: true, remoteJidAlt: true, profilePic: true }
            });
            dbContacts.forEach(c => {
                if (c.profilePic) results[c.jid] = c.profilePic;
                const alt = c.lid || c.remoteJidAlt;
                if (alt) contactMap.set(c.jid, alt);
            });
        }

        // Filter out already known
        const targets = jids.filter(j => !results[j]);

        await Promise.allSettled(
            targets.map(async (jid) => {
                try {
                    const cleanJid = decodeURIComponent(jid);
                    let ppUrl: string | null = null;
                    try {
                        const res = await withTimeout(instance.socket!.profilePictureUrl(cleanJid, 'image'), 2000, null);
                        ppUrl = res || null;
                    } catch {
                        const alt = contactMap.get(cleanJid);
                        if (alt) {
                            try {
                                const res = await withTimeout(instance.socket!.profilePictureUrl(alt, 'image'), 2000, null);
                                ppUrl = res || null;
                            } catch {
                                ppUrl = null;
                            }
                        }
                    }

                    if (ppUrl) {
                        results[jid] = ppUrl;
                        if (dbSessionId) {
                            prisma.contact.updateMany({
                                where: { sessionId: dbSessionId, jid: cleanJid },
                                data: { profilePic: ppUrl }
                            }).catch(() => {});
                        }
                    }
                } catch {
                    // No profile picture or privacy restricted
                }
            })
        );

        return results;
    } catch {
        return {};
    }
}


