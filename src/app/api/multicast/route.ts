import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { broadcastSchema } from "@/lib/validations";
import { canAccessSession } from "@/lib/api-auth";
import { enforceApiQuota } from "@/lib/rate-limit";
import type { AnyMessageContent } from "@whiskeysockets/baileys";
import z from "zod";

export async function POST(request: NextRequest) {
    try {
        const gate = await enforceApiQuota(request, "multicast");
        if (gate.error) return gate.error;
        const { user } = gate;

        const body = await request.json();
        // Extend schema to support multiple sessionIds
        const multicastSchema = broadcastSchema.extend({
            sessionIds: z.array(z.string().min(1)).min(1, "At least one session required"),
            distributionStrategy: z.enum(["round_robin", "random", "load_balanced"]).optional().default("round_robin")
        });

        const parseResult = multicastSchema.safeParse(body);
        if (!parseResult.success) {
             return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
        }

        const { sessionIds, recipients, message, delay, distributionStrategy } = parseResult.data;

        // Validate access to all sessions
        for (const sessionId of sessionIds) {
            const canAccess = await canAccessSession(user.id, user.role, sessionId);
            if (!canAccess) {
                return NextResponse.json({ status: false, message: "Forbidden", error: "Forbidden" }, { status: 403 });
            }
        }

        // Get instances for all sessions
        const instances: { sessionId: string, instance: any }[] = [];
        for (const sessionId of sessionIds) {
            const instance = waManager.getInstance(sessionId);
            if (instance?.socket) {
                instances.push({ sessionId, instance });
            }
        }

        if (instances.length === 0) {
            return NextResponse.json({ status: false, message: "No valid sessions ready", error: "No valid sessions ready" }, { status: 503 });
        }

        const messageContent: AnyMessageContent = { text: message };
        const io = (global as any).io;
        const multicastId = `mc_${Date.now()}`;
        const totalRecipients = recipients.length;

        // Distribute recipients based on strategy
        let recipientDistribution: Record<string, string[]> = {};
        if (distributionStrategy === "round_robin") {
            recipients.forEach((recipient, index) => {
                const sessionIndex = index % instances.length;
                const sessionId = instances[sessionIndex].sessionId;
                if (!recipientDistribution[sessionId]) recipientDistribution[sessionId] = [];
                recipientDistribution[sessionId].push(recipient);
            });
        } else if (distributionStrategy === "random") {
            recipients.forEach(recipient => {
                const randomIndex = Math.floor(Math.random() * instances.length);
                const sessionId = instances[randomIndex].sessionId;
                if (!recipientDistribution[sessionId]) recipientDistribution[sessionId] = [];
                recipientDistribution[sessionId].push(recipient);
            });
        } else if (distributionStrategy === "load_balanced") {
            // Simple load balancing based on current message count (if available)
            // For now, fallback to round robin
            recipients.forEach((recipient, index) => {
                const sessionIndex = index % instances.length;
                const sessionId = instances[sessionIndex].sessionId;
                if (!recipientDistribution[sessionId]) recipientDistribution[sessionId] = [];
                recipientDistribution[sessionId].push(recipient);
            });
        }

        // Emit initial multicast state
        if (io) {
            io.to(sessionIds).emit("multicast.progress", {
                multicastId,
                status: "running",
                total: totalRecipients,
                sent: 0,
                failed: 0,
                current: null,
                startedAt: new Date().toISOString(),
                sessionIds
            });
        }

        // Process in background
        (async () => {
            let totalSent = 0;
            let totalFailed = 0;
            const allErrors: { jid: string; error: string; sessionId: string }[] = [];

            // Process each session's recipient list
            for (const { sessionId, instance } of instances) {
                const sessionRecipients = recipientDistribution[sessionId] || [];
                let sent = 0;
                let failed = 0;
                const errors: { jid: string; error: string }[] = [];

                for (let i = 0; i < sessionRecipients.length; i++) {
                    const jid = sessionRecipients[i];
                    try {
                        // Apply anti-ban humanization before sending
                        const { antiban } = await import("@/modules/whatsapp/antiban");
                        await antiban.humanize(instance.socket, sessionId, jid, messageContent);
                        
                        await instance.socket.sendMessage(jid, messageContent);
                        sent++;
                    } catch (e: any) {
                        failed++;
                        errors.push({ jid, error: e.message || "Unknown error" });
                        console.error(`Failed to send multicast to ${jid} from session ${sessionId}`, e);
                    }

                    // Emit progress after each message
                    if (io) {
                        io.to(sessionId).emit("multicast.progress", {
                            multicastId,
                            status: "running",
                            total: totalRecipients,
                            sent: totalSent + sent,
                            failed: totalFailed + failed,
                            current: jid,
                            progress: Math.round(((totalSent + sent + totalFailed + failed) / totalRecipients) * 100),
                            sessionId: sessionId
                        });
                    }

                    // Enhanced anti-ban delay with more human-like variation
                    if (i < sessionRecipients.length - 1) {
                        const baseDelay = delay || 2000;
                        // More sophisticated delay pattern: base + typing time + random variation
                        const typingTime = Math.min(3000, message.length * 20); // ~20ms per char for typing simulation
                        const randomVariation = Math.floor(Math.random() * baseDelay * 0.3); // ±30% variation
                        const delayTime = baseDelay + typingTime + randomVariation;
                        
                        await new Promise(r => setTimeout(r, delayTime));
                    }
                }

                totalSent += sent;
                totalFailed += failed;
                allErrors.push(...errors.map(e => ({ ...e, sessionId })));
            }

            // Emit completion
            if (io) {
                io.to(sessionIds).emit("multicast.progress", {
                    multicastId,
                    status: "completed",
                    total: totalRecipients,
                    sent: totalSent,
                    failed: totalFailed,
                    errors: allErrors,
                    progress: 100,
                    completedAt: new Date().toISOString()
                });
            }
            
            console.log(`Multicast ${multicastId} completed: ${totalSent} sent, ${totalFailed} failed out of ${totalRecipients} using ${instances.length} sessions`);
        })();

        return NextResponse.json({ 
            status: true, 
            message: `Multicast started using ${instances.length} session(s)`, 
            data: { multicastId, total: totalRecipients, sessionsUsed: instances.length } 
        });

    } catch (e) {
        console.error("Multicast error", e);
        return NextResponse.json({ status: false, message: "Failed to start multicast", error: "Failed to start multicast" }, { status: 500 });
    }
}