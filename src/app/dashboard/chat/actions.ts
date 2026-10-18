"use server";

import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { getAuthenticatedUserForAction } from "@/lib/server-action-auth";
import { canAccessSession } from "@/lib/api-auth";
import { waManager } from "@/modules/whatsapp/manager";
import { normalizeJid } from "@/lib/jid-utils";
import { executeSmartChat } from "@/lib/ai-gateway/gateway";
import { logger } from "@/lib/logger";

import { WhatsAppInstance } from "@/modules/whatsapp/instance";

// In-memory cache for mapping Baileys sessionId string to DB Session CUID
const sessionDbIdCache = new Map<string, { id: string; expires: number }>();

async function getDbSessionId(sessionId: string): Promise<string | null> {
    if (!sessionId) return null;
    const cached = sessionDbIdCache.get(sessionId);
    if (cached && cached.expires > Date.now()) {
        return cached.id;
    }
    const session = await prisma.session.findFirst({
        where: {
            OR: [
                { id: sessionId },
                { sessionId: sessionId },
                { name: sessionId }
            ]
        },
        select: { id: true }
    });
    if (session) {
        sessionDbIdCache.set(sessionId, { id: session.id, expires: Date.now() + 5 * 60 * 1000 });
        return session.id;
    }
    return null;
}

async function getSessionInstance(sessionId: string): Promise<WhatsAppInstance | null> {
    if (!sessionId) return null;
    let instance = waManager.getInstance(sessionId);
    if (instance?.socket) return instance;

    const sessionRecord = await prisma.session.findFirst({
        where: {
            OR: [
                { id: sessionId },
                { sessionId: sessionId },
                { name: sessionId }
            ]
        },
        select: { id: true, sessionId: true, status: true, userId: true, name: true }
    });

    if (!sessionRecord) return null;

    instance = waManager.getInstance(sessionRecord.sessionId) || waManager.getInstance(sessionRecord.id);
    if (instance?.socket) return instance;

    // Auto-revive in-memory instance if DB says CONNECTED but memory was cleared (e.g. Next.js Turbopack fast refresh)
    if (sessionRecord.status === "CONNECTED" && !instance) {
        logger.info("Chat", `Auto-recovering in-memory socket instance for session ${sessionRecord.sessionId} (${sessionRecord.name})...`);
        const io = (global as any).io || (waManager as any).io;
        if (io) {
            instance = new WhatsAppInstance(sessionRecord.sessionId, sessionRecord.userId, io);
            (waManager as any).sessions.set(sessionRecord.sessionId, instance);
            await instance.init().catch((e: any) => logger.error("Chat", "Auto-revive failed", e));
        }
    }

    return instance || null;
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

    const messages = await ChatService.getMessages(dbSessionId, jid, 250);

    return messages.map((msg: any) => ({
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

    // Check if local socket is active. If not, check if session is CONNECTED in DB (e.g. running on Render)
    const instance = await getSessionInstance(sessionId);
    if (!instance?.socket || instance.status !== "CONNECTED") {
        const sessionRecord = await prisma.session.findFirst({
            where: { OR: [{ id: sessionId }, { sessionId: sessionId }, { name: sessionId }] },
            select: { id: true, sessionId: true, status: true }
        });
        if (sessionRecord?.status === "CONNECTED") {
            const isLocal = process.env.NODE_ENV !== "production" || !process.env.RENDER;
            if (isLocal) {
                try {
                    const liveRenderUrl = "https://whats-gateway.onrender.com";
                    const forwardRes = await fetch(`${liveRenderUrl}/api/messages/${sessionRecord.sessionId}/${encodeURIComponent(jid)}/send`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-internal-secret": process.env.AUTH_SECRET || ""
                        },
                        body: JSON.stringify({ message: { text } })
                    });
                    if (forwardRes.ok) {
                        return {
                            success: true,
                            keyId: `fw-${Date.now()}`,
                            timestamp: new Date().toISOString()
                        };
                    }
                } catch (err: any) {
                    logger.warn("Chat", "Forwarding send message to live Render failed:", err?.message);
                }
            }
        }
    }

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

        const instance = await getSessionInstance(sessionId);
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

        const instance = await getSessionInstance(sessionId);
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
            dbContacts.forEach((c: any) => {
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

/**
 * On-demand sync of earlier message history directly from the linked WhatsApp phone
 */
export async function syncChatHistory(sessionId: string, jid: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

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
    if (!sessionRecord) throw new Error(`Session "${sessionId}" not found in database`);

    const dbSessionId = sessionRecord.id;
    let instance = await getSessionInstance(sessionId);
    const socketReady = !!(instance && instance.socket && instance.status === "CONNECTED");
    const normalizedJid = normalizeJid(jid);
    const queryJids = Array.from(new Set([jid, normalizedJid]));

    // Record initial message count so we know when WhatsApp phone delivers history
    const initialCount = await prisma.message.count({
        where: {
            sessionId: dbSessionId,
            remoteJid: { in: queryJids }
        }
    });

    // If local instance is not connected, but DB indicates session is CONNECTED in production:
    if (!socketReady && sessionRecord.status === "CONNECTED") {
        const liveRenderUrl = "https://whats-gateway.onrender.com";
        const isLocal = process.env.NODE_ENV !== "production" || !process.env.RENDER;
        if (isLocal) {
            try {
                logger.info("Chat", `Local socket not active. Forwarding sync to live Render instance...`);
                const forwardRes = await fetch(`${liveRenderUrl}/api/chat/${sessionRecord.sessionId}/${encodeURIComponent(jid)}/sync-history`, {
                    method: "POST",
                    headers: {
                        "x-internal-secret": process.env.AUTH_SECRET || ""
                    }
                });
                if (forwardRes.ok) {
                    // Poll DB for new messages delivered by WhatsApp phone (up to 8s)
                    for (let i = 0; i < 8; i++) {
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        const currentCount = await prisma.message.count({
                            where: {
                                sessionId: dbSessionId,
                                remoteJid: { in: queryJids }
                            }
                        });
                        if (currentCount > initialCount) {
                            // Extra 1.5s for remaining messages in batch to settle in DB
                            await new Promise((resolve) => setTimeout(resolve, 1500));
                            break;
                        }
                    }
                    const messages = await ChatService.getMessages(dbSessionId, jid, 500);
                    return {
                        success: true,
                        messages: messages.map((msg: any) => ({
                            ...msg,
                            timestamp: msg.timestamp.toISOString()
                        }))
                    };
                } else {
                    const errBody = await forwardRes.json().catch(() => ({}));
                    logger.warn("Chat", "Forwarding response not ok:", forwardRes.status, errBody);
                }
            } catch (err: any) {
                logger.warn("Chat", "Forwarding to live Render failed:", err?.message);
            }
        }

        // Return up to 500 messages from DB
        const fallbackMessages = await ChatService.getMessages(dbSessionId, jid, 500);
        return {
            success: true,
            messages: fallbackMessages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp.toISOString()
            }))
        };
    }

    if (!instance || !instance.socket || instance.status !== "CONNECTED") {
        const displayStatus = instance?.status || sessionRecord.status;
        throw new Error(`WhatsApp session "${sessionRecord.name || sessionId}" is not connected (Status: ${displayStatus}). Please check Sessions / QR menu.`);
    }

    // Find the oldest message we have in the database for this chat
    const oldestMessage = await prisma.message.findFirst({
        where: {
            sessionId: dbSessionId,
            remoteJid: { in: queryJids }
        },
        orderBy: { timestamp: "asc" },
        select: { keyId: true, fromMe: true, timestamp: true }
    });

    const oldestKey = oldestMessage ? {
        remoteJid: normalizedJid,
        fromMe: oldestMessage.fromMe,
        id: oldestMessage.keyId
    } : {
        remoteJid: normalizedJid,
        fromMe: false,
        id: "0"
    };

    const oldestTimestampMs = oldestMessage
        ? oldestMessage.timestamp.getTime()
        : Date.now();

    try {
        logger.info("Chat", `Requesting earlier message history for ${jid} from WhatsApp phone...`);
        // Request history from WhatsApp phone (50 messages per query)
        await (instance.socket as any).fetchMessageHistory(50, oldestKey as any, oldestTimestampMs);
        
        // Poll DB for new messages delivered by WhatsApp phone (up to 8s)
        for (let i = 0; i < 8; i++) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const currentCount = await prisma.message.count({
                where: {
                    sessionId: dbSessionId,
                    remoteJid: { in: queryJids }
                }
            });
            if (currentCount > initialCount) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                break;
            }
        }

        // Return the fresh message list (up to 500 messages)
        const messages = await ChatService.getMessages(dbSessionId, jid, 500);
        return {
            success: true,
            messages: messages.map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp.toISOString()
            }))
        };
    } catch (err: any) {
        logger.error("Chat", `Failed to fetch message history for ${jid}: ${err?.message}`);
        throw new Error(err?.message || "Failed to sync previous messages from WhatsApp");
    }
}

export interface SuggestedRepliesResult {
    analysis: string;
    suggestions: string[];
}

/**
 * AI-powered chat reply suggestions:
 * Analyzes recent chat messages + business RAG knowledge base to suggest 3 contextual replies.
 */
export async function suggestChatReplies(sessionId: string, jid: string): Promise<SuggestedRepliesResult> {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const dbSessionId = await getDbSessionId(sessionId);
    if (!dbSessionId) throw new Error("Session not found");

    const normalizedJid = normalizeJid(jid);

    // 1. Fetch recent messages for this conversation (up to 10)
    const recentMessages = await prisma.message.findMany({
        where: {
            sessionId: dbSessionId,
            OR: [
                { remoteJid: jid },
                { remoteJid: normalizedJid }
            ]
        },
        orderBy: { timestamp: "desc" },
        take: 10,
        select: {
            fromMe: true,
            content: true,
            type: true,
            timestamp: true,
            pushName: true
        }
    });

    if (recentMessages.length === 0) {
        return {
            analysis: "New conversation initiated",
            suggestions: [
                "Namaste! Welcome to our clinic. How can I assist you today?",
                "Hello! Thanks for reaching out. What can we help you with?",
                "Hi! Would you like to know more about our services or book a quick consultation/demo?"
            ]
        };
    }

    // Chronological order for prompt
    const chronological = recentMessages.slice().reverse();
    const transcript = chronological
        .filter((m: any) => m.content && m.content.trim())
        .map((m: any) => `${m.fromMe ? "Business Agent" : (m.pushName || "Customer")}: ${m.content}`)
        .join("\n");

    const latestCustomerMsg = chronological
        .slice()
        .reverse()
        .find((m: any) => !m.fromMe && m.content && m.content.trim())?.content || chronological[chronological.length - 1]?.content || "Inquiry";

    try {
        const aiResult = await executeSmartChat({
            question: `Analyze this WhatsApp conversation and suggest 3 contextual replies.\n\nLatest Customer Message: "${latestCustomerMsg}"\n\nRecent Conversation Transcript:\n${transcript}`,
            useRAG: true,
            customSystemPrompt: `You are an AI sales & customer support copilot for our WhatsApp business.
Analyze the customer's message and the conversation context. Generate exactly 3 short, natural, high-converting suggested replies that the human agent can send on WhatsApp.
Option 1: Quick & Direct (1 sentence, directly answering the question)
Option 2: Value-focused & Informative (1-2 sentences with benefits/pricing from knowledge base)
Option 3: Action-Oriented (1-2 sentences offering a demo, consultation, or next step)

Language & Tone:
- Match the customer's language and style (if they used Hinglish, reply in friendly Hinglish; if Hindi, reply in Hindi; if English, reply in English).
- Strictly adhere to our business information and pricing. NEVER invent lower prices or fake plans.
- Keep each reply concise (under 25 words).

OUTPUT REQUIREMENT:
Output ONLY valid JSON with this exact structure:
{
  "analysis": "1 short sentence describing customer intent and sentiment",
  "suggestions": [
    "Option 1 text",
    "Option 2 text",
    "Option 3 text"
  ]
}`
        });

        const raw = aiResult.answer.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
                return {
                    analysis: parsed.analysis || "Customer inquiry analyzed",
                    suggestions: parsed.suggestions.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 3)
                };
            }
        }

        // Fallback if model didn't return valid JSON array
        return {
            analysis: "Contextual suggestion ready",
            suggestions: [
                raw.slice(0, 150),
                "Ji bilkul, iske baare mein main aapko poori details provide kar sakta hoon.",
                "Kya aap ek quick demo schedule karna chahenge jisme hum aapko poora workflow dikha sakein?"
            ]
        };
    } catch (err: any) {
        logger.warn("Chat", "AI reply suggestion fallback due to error:", err?.message);
        return {
            analysis: "Standard business responses",
            suggestions: [
                "Ji bilkul, main isme aapki poori madad kar sakta hoon. Kripya thoda aur detail batayein?",
                "Hamare Starter plan ₹1,499/month se shuru hota hai jisme sabhi primary features shamil hain.",
                "Kya aap convenient time bata sakte hain taaki hum aapke liye ek quick live demo schedule kar sakein?"
            ]
        };
    }
}



