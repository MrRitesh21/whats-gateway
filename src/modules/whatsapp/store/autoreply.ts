import { prisma } from "@/lib/prisma";
import type { WASocket } from "@whiskeysockets/baileys";
import { normalizeMessageContent } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { userPlanAllows } from "@/lib/plans-store";
import { resolveToPhoneJid, isLidJid, normalizeJid } from "@/lib/jid-utils";

// Helper for permission check (Deduplicate from command-handler if possible, but keep simple here)
function canAutoReply(config: any, fromMe: boolean, senderJid: string): boolean {
    if (!config || !config.enabled) return false;

    // Auto Reply Specific Mode
    const mode = config.autoReplyMode || 'ALL';

    if (fromMe) {
        // If mode is OWNER, it triggers for ME? 
        // Auto Reply usually replies TO someone. 
        // If I send a message, and mode is OWNER, should it reply to me? 
        // User requested "Self Mode" -> Use case: Snippets.
        // So yes, if fromMe checks out.

        // However, standard auto-reply logic (replying to incoming) should be blocked if fromMe is true AND mode is ALL?
        // No, typically Auto Reply doesn't trigger on own messages to prevent unexpected loops.
        // But for "Self Mode" (Macros), it MUST trigger on own messages.

        if (mode === 'OWNER') return true;
        if (mode === 'ALL') return false; // Standard auto-reply ignores self

        // Specific? 
        return false;
    } else {
        // Incoming message from others
        if (mode === 'OWNER') return false; // Owner only acts on Owner messages
        if (mode === 'ALL') return true;

        if (mode === 'SPECIFIC') {
            const allowedJids = config.autoReplyAllowedJids || [];
            if (Array.isArray(allowedJids)) {
                return allowedJids.some((jid: string) => senderJid.includes(jid));
            }
        }

        if (mode === 'BLACKLIST') {
            const blockedJids = config.autoReplyBlockedJids || [];
            if (Array.isArray(blockedJids)) {
                const isBlocked = blockedJids.some((jid: string) => senderJid.includes(jid));
                return !isBlocked; // Return true if NOT blocked
            }
            return true; // If blacklist empty, allow all
        }
    }

    return false;
}

export async function bindAutoReply(sock: WASocket, sessionId: string) {
    if (!sock || !sock.ev) {
        return;
    }
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        // Fetch session ID and Bot Config once per batch (optimization)
        const session = await prisma.session.findUnique({
            where: { sessionId },
            // @ts-ignore
            include: { botConfig: true }
        });

        if (!session) return;

        // @ts-ignore
        let config = (session as any).botConfig;

        if (!config) {
            logger.warn("AutoReply", "No config found, creating default...");
            config = await prisma.botConfig.create({
                data: {
                    sessionId: session.id,
                    enabled: true,
                    botMode: 'OWNER',
                    autoReplyMode: 'ALL'
                }
            });
        }

        logger.debug("AutoReply", `Processing for ${sessionId}. Config: ${config ? "Found" : "Missing"}, ${config?.enabled ? "Enabled" : "Disabled"}`);

        if (!config || !config.enabled) return;

        // Plan gating: kalau plan pemilik session tidak mengizinkan Auto Reply, jangan balas.
        if (!(await userPlanAllows((session as any).userId, "autoReply"))) return;

        for (const msg of messages) {
            const fromMe = msg.key.fromMe || false;
            const remoteJid = msg.key.remoteJid;

            // Standardized Sender Logic
            const isGroup = remoteJid?.endsWith("@g.us") || false;
            const remoteJidAlt = msg.key.remoteJidAlt;
            let senderJid = (isGroup ? (msg.key.participant || msg.participant) : remoteJid);

            if (!isGroup && remoteJidAlt) {
                senderJid = remoteJidAlt;
            }

            if (!remoteJid || !senderJid) continue;

            // Check Permissions
            if (!canAutoReply(config, fromMe, senderJid)) continue;

            const content = normalizeMessageContent(msg.message);
            const text = content?.conversation || content?.extendedTextMessage?.text || ""; // Caption?

            if (!text) continue;

            try {
                // Fetch rules for this session
                const rules = await prisma.autoReply.findMany({
                    where: {
                        session: {
                            sessionId: sessionId
                        }
                    }
                });

                let matchedRule = false;
                for (const rule of rules) {
                    let match = false;
                    const keyword = rule.keyword.toLowerCase();
                    const incoming = text.toLowerCase();

                    switch (rule.matchType) {
                        case 'EXACT':
                            match = incoming === keyword;
                            break;
                        case 'CONTAINS':
                            match = incoming.includes(keyword);
                            break;
                        case 'STARTS_WITH':
                            match = incoming.startsWith(keyword);
                            break;
                        case 'REGEX':
                            try {
                                const regex = new RegExp(rule.keyword, 'i');
                                match = regex.test(text); // Use original case for regex
                            } catch (e) {
                                logger.error("AutoReply", "Invalid regex in auto-reply", rule.keyword);
                            }
                            break;
                        default:
                            // Unknown match type — fall back to contains (most forgiving)
                            match = incoming.includes(keyword);
                            break;
                    }

                    if (match) {
                        // Check trigger context (GROUP, PRIVATE, or ALL)
                        const isGroup = remoteJid.endsWith('@g.us');
                        const triggerType = (rule as any).triggerType || 'ALL'; // Default to ALL if undefined

                        if (triggerType === 'GROUP' && !isGroup) continue;
                        if (triggerType === 'PRIVATE' && isGroup) continue;

                        matchedRule = true;
                        logger.info("AutoReply", `Match: ${rule.keyword} -> ${remoteJid}`);

                        if (rule.isMedia && rule.mediaUrl) {
                            const url = rule.mediaUrl;
                            const isVideo = url.endsWith('.mp4') || url.endsWith('.avi') || url.endsWith('.mov');
                            const isDocument = url.endsWith('.pdf') || url.endsWith('.doc') || url.endsWith('.docx') || url.endsWith('.zip');

                            try {
                                const res = await fetch(url);
                                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                                const buffer = Buffer.from(await res.arrayBuffer());

                                if (isVideo) {
                                    await sock.sendMessage(remoteJid, {
                                        video: buffer,
                                        caption: rule.response
                                    }, { quoted: msg });
                                } else if (isDocument) {
                                    await sock.sendMessage(remoteJid, {
                                        document: buffer,
                                        caption: rule.response,
                                        mimetype: 'application/octet-stream',
                                        fileName: url.split('/').pop() || 'document'
                                    }, { quoted: msg });
                                } else {
                                    await sock.sendMessage(remoteJid, {
                                        image: buffer,
                                        caption: rule.response
                                    }, { quoted: msg });
                                }
                            } catch (err: any) {
                                logger.error("AutoReply", `Failed to send media auto-reply from URL: ${err.message}. Falling back to text.`);
                                await sock.sendMessage(remoteJid, { text: rule.response }, { quoted: msg });
                            }
                        } else {
                            await sock.sendMessage(remoteJid, { text: rule.response }, { quoted: msg });
                        }

                        break;
                    }
                }

                // Fallback to Smart AI RAG Auto-Reply if no static keyword matched
                if (!matchedRule) {
                    try {
                        const { getAIGatewayData } = await import("@/lib/ai-gateway/storage");
                        const aiData = await getAIGatewayData(session.userId);
                        const ragCfg = aiData.ragConfig;
                        const isSessionEnabled = !ragCfg.whatsappSessions?.length || ragCfg.whatsappSessions.includes(sessionId);
                        const isCommand = /^[#!/.][a-zA-Z0-9]/.test(text.trim());
                        const isGroup = remoteJid.endsWith("@g.us");

                        // Trigger Smart RAG on 1-on-1 chats if enabled
                        if (ragCfg.enableWhatsAppAutoReply && isSessionEnabled && !isCommand && !isGroup) {
                            // Resolve to Phone JID if LID
                            let phoneJid = remoteJid;
                            if (isLidJid(remoteJid)) {
                                phoneJid = await resolveToPhoneJid(remoteJid, session.id, remoteJidAlt);
                            }

                            // Build comprehensive query set so all messages from both phone and LID aliases are found
                            const historyJids = new Set([remoteJid, phoneJid]);
                            try {
                                const contact = await prisma.contact.findFirst({
                                    where: {
                                        sessionId: session.id,
                                        OR: [{ jid: remoteJid }, { lid: remoteJid }, { jid: phoneJid }, { lid: phoneJid }]
                                    },
                                    select: { jid: true, lid: true, remoteJidAlt: true }
                                });
                                if (contact) {
                                    if (contact.jid) historyJids.add(contact.jid);
                                    if (contact.lid) historyJids.add(contact.lid);
                                    if (contact.remoteJidAlt) historyJids.add(contact.remoteJidAlt);
                                }
                            } catch {}

                            // Fetch past 10 messages from this contact for conversation context
                            let chatHistory: any[] = [];
                            try {
                                const pastMsgs = await prisma.message.findMany({
                                    where: {
                                        sessionId: session.id,
                                        remoteJid: { in: Array.from(historyJids) },
                                    },
                                    orderBy: { timestamp: "desc" },
                                    take: 10,
                                    select: { fromMe: true, content: true }
                                });
                                chatHistory = pastMsgs
                                    .reverse()
                                    .filter((m) => m.content && m.content.trim().length > 0)
                                    .map((m) => ({
                                        role: m.fromMe ? ("assistant" as const) : ("user" as const),
                                        content: m.content || "",
                                    }));
                            } catch (histErr) {
                                logger.debug("AutoReply", "Failed to load chat history (non-fatal)", histErr);
                            }

                            const { executeSmartChat } = await import("@/lib/ai-gateway/gateway");
                            const aiRes = await executeSmartChat({
                                question: text.trim(),
                                useRAG: true,
                                chatHistory,
                                userId: session.userId,
                            });

                            if (aiRes.answer) {
                                let cleanAnswer = aiRes.answer;
                                const meetingMatch = cleanAnswer.match(/\[SCHEDULE_MEETING:\s*([^\|\]]+)(?:\|\s*([^\|\]]+))?(?:\|\s*([^\]]+))?\]/i);

                                if (meetingMatch) {
                                    cleanAnswer = cleanAnswer.replace(/\[SCHEDULE_MEETING:[^\]]+\]/gi, "").trim();
                                    const meetingTime = meetingMatch[1]?.trim() || "Upcoming";
                                    const meetingTopic = meetingMatch[2]?.trim() || "Product Demo";
                                    const meetingNotes = meetingMatch[3]?.trim() || `Inbound WhatsApp request: ${text.slice(0, 80)}`;

                                    // Automatically record scheduled meeting in CRM as QUALIFIED/HOT lead!
                                    try {
                                        const { getCRMData, saveCRMData } = await import("@/lib/crm/storage");
                                        const crmStore = await getCRMData();
                                        const cleanPhone = (phoneJid || remoteJid).replace(/@.*$/, "").replace(/[^0-9]/g, "");
                                        let lead = crmStore.leads.find((l: any) => l.whatsappJid === phoneJid || l.whatsappJid === remoteJid || l.formattedPhone === cleanPhone);

                                        if (lead) {
                                            lead.stage = "QUALIFIED";
                                            lead.priority = "HOT";
                                            lead.followUpDate = meetingTime;
                                            lead.followUpNote = `[AI Auto-Scheduled Demo]: ${meetingTime} | Topic: ${meetingTopic}. Note: ${meetingNotes}`;
                                            lead.activities = lead.activities || [];
                                            lead.activities.unshift({
                                                id: Math.random().toString(36).substring(7),
                                                type: "followup",
                                                content: `Demo scheduled via WhatsApp AI: ${meetingTime} (${meetingTopic})`,
                                                createdAt: new Date().toISOString(),
                                                author: "AI Assistant",
                                            });
                                        } else {
                                            const leadWaJid = phoneJid.endsWith("@s.whatsapp.net") ? phoneJid : `${cleanPhone}@s.whatsapp.net`;
                                            crmStore.leads.unshift({
                                                id: Math.random().toString(36).substring(7),
                                                name: meetingTopic !== "Product Demo" ? meetingTopic : "WhatsApp Lead",
                                                phone: cleanPhone,
                                                formattedPhone: cleanPhone,
                                                whatsappJid: leadWaJid,
                                                category: "Demo Request",
                                                stage: "QUALIFIED",
                                                priority: "HOT",
                                                followUpDate: meetingTime,
                                                followUpNote: `[AI Auto-Scheduled Demo]: ${meetingTime}. Note: ${meetingNotes}`,
                                                tags: ["AI-Demo", "WhatsApp-Inbound"],
                                                createdAt: new Date().toISOString(),
                                                updatedAt: new Date().toISOString(),
                                            });
                                        }
                                        await saveCRMData(crmStore);
                                        logger.success("AutoReply", `AI Auto-Scheduled Demo for ${remoteJid} at ${meetingTime}`);
                                    } catch (crmErr) {
                                        logger.error("AutoReply", "Failed to save AI meeting to CRM:", crmErr);
                                    }
                                }

                                const { antiban } = await import("@/modules/whatsapp/antiban");
                                const payload = { text: cleanAnswer };
                                await antiban.humanize(sock, sessionId, remoteJid, payload);
                                await sock.sendMessage(remoteJid, payload, { quoted: msg });
                                logger.info("AutoReply", `Smart AI RAG replied to ${remoteJid} via ${aiRes.accountUsed.provider}:${aiRes.accountUsed.model}`);
                            }
                        }
                    } catch (aiErr: any) {
                        logger.debug("AutoReply", "Smart AI RAG auto-reply non-fatal error", aiErr);
                    }
                }

            } catch (e) {
                logger.error("AutoReply", "Error executing auto-reply", e);
            }
        }
    });
}
