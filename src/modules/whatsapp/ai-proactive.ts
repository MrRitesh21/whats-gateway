import { prisma } from "@/lib/prisma";
import { waManager } from "./manager";
import { logger } from "@/lib/logger";
import { antiban } from "./antiban";

// In-memory set to prevent multiple follow-ups to the same contact within 24 hours
const contactedWithin24h = new Map<string, number>();

/**
 * Scan for stalled conversations across active sessions and let AI evaluate
 * whether a polite proactive self-message / follow-up should be sent.
 */
export async function runAIProactiveFollowupCheck(): Promise<void> {
    try {
        const { getAIGatewayData } = await import("@/lib/ai-gateway/storage");
        // Find the owner of this session to ensure user isolation
        const sessionRecord = await prisma.session.findUnique({
            where: { sessionId },
            select: { userId: true },
        }).catch(() => null);
        const sessionUserId = sessionRecord?.userId || undefined;

        const aiData = await getAIGatewayData(sessionUserId);
        const ragConfig = aiData.ragConfig;

        // Only run if AI auto-reply is globally configured and at least one AI account is active
        if (!ragCfg.enableWhatsAppAutoReply) return;
        const activeAccounts = aiData.accounts.filter(a => a.isActive);
        if (activeAccounts.length === 0) return;

        const now = Date.now();
        const minSilenceMs = 20 * 60 * 1000;   // At least 20 minutes of silence
        const maxSilenceMs = 24 * 60 * 60 * 1000; // Not older than 24 hours

        // Clean up 24h tracker
        for (const [key, ts] of contactedWithin24h.entries()) {
            if (now - ts > 24 * 60 * 60 * 1000) contactedWithin24h.delete(key);
        }

        // Find active sessions in database
        const activeSessions = await prisma.session.findMany({
            where: { status: "CONNECTED" },
            select: { id: true, sessionId: true, name: true }
        });

        for (const session of activeSessions) {
            // Check if session is enabled in RAG config
            if (ragCfg.whatsappSessions?.length && !ragCfg.whatsappSessions.includes(session.sessionId)) {
                continue;
            }

            const instance = waManager.getInstance(session.sessionId);
            if (!instance?.socket) continue;

            // Find distinct 1-on-1 contacts with messages in the last 24 hours
            const recentMessages = await prisma.message.findMany({
                where: {
                    sessionId: session.id,
                    remoteJid: {
                        endsWith: "@s.whatsapp.net",
                        not: { contains: "status" }
                    },
                    timestamp: {
                        gte: new Date(now - maxSilenceMs),
                        lte: new Date(now - minSilenceMs)
                    }
                },
                orderBy: { timestamp: "desc" },
                take: 50,
                select: { remoteJid: true, timestamp: true }
            });

            const uniqueJids = Array.from(new Set(recentMessages.map(m => m.remoteJid)));

            for (const jid of uniqueJids) {
                const trackingKey = `${session.sessionId}:${jid}`;
                if (contactedWithin24h.has(trackingKey)) continue;

                // Fetch recent conversation history
                const chatMsgs = await prisma.message.findMany({
                    where: {
                        sessionId: session.id,
                        remoteJid: jid
                    },
                    orderBy: { timestamp: "desc" },
                    take: 6,
                    select: { fromMe: true, content: true, timestamp: true }
                });

                if (chatMsgs.length === 0) continue;

                const lastMsg = chatMsgs[0];
                const silenceDuration = now - new Date(lastMsg.timestamp).getTime();

                // Only follow up if there has been silence between 20 mins and 24 hours
                if (silenceDuration < minSilenceMs || silenceDuration > maxSilenceMs) continue;

                // Build conversation summary for evaluation
                const conversationContext = chatMsgs
                    .reverse()
                    .filter(m => m.content && m.content.trim().length > 0)
                    .map(m => `${m.fromMe ? "Assistant" : "Customer"}: ${m.content}`)
                    .join("\n");

                if (!conversationContext) continue;

                // Prompt AI to decide whether to follow up
                const evaluationQuestion = `
You are an intelligent business assistant representing this shop/business.
Analyze this recent WhatsApp conversation with a customer:

--- CONVERSATION START ---
${conversationContext}
--- CONVERSATION END ---

QUESTION: Has the customer inquired or shown interest, but the conversation went quiet without a resolution or scheduled demo?
DECIDE:
- If a gentle, polite follow-up message would be helpful right now (e.g. asking if they still want to schedule a demo, check out our products, or have any questions):
  Output ONLY the message you want to send to the customer on WhatsApp (in 1-2 friendly sentences, Hindi/English, no quotes, no preamble).
- If NOT appropriate (e.g. conversation concluded, customer said bye/no, issue already solved, or message was irrelevant):
  Output EXACTLY: SKIP
`;

                try {
                    const { executeSmartChat } = await import("@/lib/ai-gateway/gateway");
                    const evaluation = await executeSmartChat({
                        question: evaluationQuestion,
                        useRAG: false,
                    });

                    const reply = evaluation.answer?.trim();
                    if (reply && !reply.toUpperCase().includes("SKIP") && reply.length > 5 && reply.length < 300) {
                        // Mark as contacted for 24 hours
                        contactedWithin24h.set(trackingKey, now);

                        // Strip any accidental prefix
                        const cleanMsg = reply.replace(/^(assistant:|bot:|message:)\s*/i, "").trim();

                        const payload = { text: cleanMsg };
                        await antiban.humanize(instance.socket, session.sessionId, jid, payload);
                        await instance.socket.sendMessage(jid, payload);

                        logger.success("AIProactive", `Proactive self-message sent to ${jid} via session ${session.sessionId}: "${cleanMsg.slice(0, 50)}..."`);

                        // Small delay between proactive messages
                        await new Promise(r => setTimeout(r, 4000));
                    } else {
                        // Mark evaluated so we don't spam API calls every cycle
                        contactedWithin24h.set(trackingKey, now - (20 * 60 * 60 * 1000)); // check again in ~4 hours
                    }
                } catch (evalErr: any) {
                    logger.debug("AIProactive", `Evaluation error for ${jid}:`, evalErr);
                }
            }
        }
    } catch (err: any) {
        logger.debug("AIProactive", "Proactive follow-up cycle error (non-fatal):", err);
    }
}

let proactiveInterval: NodeJS.Timeout | null = null;

export function startAIProactiveEngine(): void {
    if (proactiveInterval) return;
    logger.info("AIProactive", "Starting AI Proactive Outreach Engine (checking every 10 mins)...");

    // Initial check after 3 minutes
    setTimeout(() => {
        runAIProactiveFollowupCheck().catch(() => {});
    }, 3 * 60 * 1000);

    // Recurring check every 10 minutes
    proactiveInterval = setInterval(() => {
        runAIProactiveFollowupCheck().catch(() => {});
    }, 10 * 60 * 1000);
}
