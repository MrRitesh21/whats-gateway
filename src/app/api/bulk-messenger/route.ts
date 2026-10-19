import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { canAccessSession, getAuthenticatedUser } from "@/lib/api-auth";
import { antiban } from "@/modules/whatsapp/antiban";
import { formatPhoneToJid } from "@/lib/jid-utils";
import { prisma } from "@/lib/prisma";
import {
    saveBulkCampaign,
    getBulkCampaigns,
    getBulkCampaign,
    deleteBulkCampaign,
} from "@/lib/bulk/storage";
import type {
    BulkCampaignRecord,
    BulkRecipientItem,
    CampaignStatus,
    FaultToleranceConfig,
    FaultToleranceStats,
} from "@/lib/bulk/types";
import { interpolateMessage } from "@/lib/bulk/template";
import { markLeadContacted } from "@/lib/crm/storage";

// ─── Default Fault Tolerance Configuration ──────────────────────────────────
const DEFAULT_FAULT_TOLERANCE: FaultToleranceConfig = {
    maxRetries: 2,               // 2 automatic retries per recipient
    retryDelayMs: 2000,          // 2s backoff base
    autoReconnectTimeoutMs: 60000, // 60s auto-reconnect grace period before auto-pausing
    autoFailover: true,          // Switch session on socket failure
    rateLimitCooldownMs: 25000,  // 25s cooldown if WhatsApp rate-limits
};

// ─── In-memory Active Campaign State ─────────────────────────────────────────
interface ActiveCampaignState {
    broadcastId: string;
    campaignName: string;
    status: CampaignStatus;
    total: number;
    sent: number;
    failed: number;
    sessionsUsed: string[];
    startedAt: string;
    completedAt?: string;
    messageTemplate: string;
    mediaUrl?: string;
    mediaType?: "image" | "video" | "document";
    fileName?: string;
    delay: number;
    rotateEvery: number;
    antiBan: boolean;
    errors: { jid: string; error: string; session: string; phone?: string; name?: string; attempts?: number }[];
    perSessionCount: Record<string, number>;
    current?: string | null;
    currentSession?: string | null;
    recipients: BulkRecipientItem[];
    source?: "manual" | "crm" | "csv";
    faultTolerance: FaultToleranceConfig;
    faultStats: FaultToleranceStats;
    reconnectMessage?: string;
    isStopped: boolean;
    isPaused: boolean;
    stop?: () => void;
    pause?: () => void;
    resume?: () => void;
}

const activeCampaigns = new Map<string, ActiveCampaignState>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jitter(base: number): number {
    const variance = base * 0.3;
    return Math.round(base + (Math.random() * 2 - 1) * variance);
}

/**
 * Pick next live session starting from preferIndex, with round-robin failover.
 * Returns null if no session in list is currently connected.
 */
function pickLiveSession(
    sessions: string[],
    preferIndex: number,
    excludeSessionId?: string,
): { sessionId: string; index: number } | null {
    const len = sessions.length;
    if (len === 0) return null;

    // First attempt: try sessions excluding the one that just failed
    if (excludeSessionId && len > 1) {
        for (let offset = 0; offset < len; offset++) {
            const idx = (preferIndex + offset) % len;
            const sid = sessions[idx];
            if (sid === excludeSessionId) continue;
            const inst = waManager.getInstance(sid);
            if (inst?.socket) return { sessionId: sid, index: idx };
        }
    }

    // Fallback: check any session
    for (let offset = 0; offset < len; offset++) {
        const idx = (preferIndex + offset) % len;
        const sid = sessions[idx];
        const inst = waManager.getInstance(sid);
        if (inst?.socket) return { sessionId: sid, index: idx };
    }
    return null;
}

/**
 * Emit real-time progress to Socket.IO clients
 */
function emitProgress(campaign: ActiveCampaignState, extra: object = {}) {
    const io = (global as any).io;
    const progress = Math.round(((campaign.sent + campaign.failed) / (campaign.total || 1)) * 100);
    const payload = {
        broadcastId: campaign.broadcastId,
        campaignName: campaign.campaignName,
        status: campaign.status,
        total: campaign.total,
        sent: campaign.sent,
        failed: campaign.failed,
        progress,
        perSessionCount: { ...campaign.perSessionCount },
        errors: campaign.errors,
        current: campaign.current,
        currentSession: campaign.currentSession,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        faultStats: campaign.faultStats,
        reconnectMessage: campaign.reconnectMessage,
        ...extra,
    };

    if (io) {
        for (const sid of campaign.sessionsUsed) {
            io.to(sid).emit("bulk.progress", payload);
        }
        io.emit("bulk.progress", payload);
    }
}

/**
 * Core Fault-Tolerant Campaign Execution Worker Loop
 */
async function runCampaignWorker(campaign: ActiveCampaignState) {
    const resolvedSessions = campaign.sessionsUsed;
    let sessionIndex = 0;
    let msgsSinceRotate = 0;

    for (let i = 0; i < campaign.recipients.length; i++) {
        if (campaign.isStopped || campaign.isPaused) break;

        const recipient = campaign.recipients[i];

        // Skip already successfully delivered recipients (resumption safety)
        if (recipient.status === "sent") {
            continue;
        }

        const jid = recipient.jid;

        // Session rotation
        if (msgsSinceRotate >= Math.max(1, campaign.rotateEvery)) {
            sessionIndex = (sessionIndex + 1) % resolvedSessions.length;
            msgsSinceRotate = 0;
        }

        // Interpolate personalized message for this recipient
        const interpolatedText = interpolateMessage(campaign.messageTemplate, {
            name: recipient.name,
            phone: recipient.phone,
            city: recipient.city,
            state: recipient.state,
            category: recipient.category,
            company: recipient.company,
            website: recipient.website,
            address: recipient.address,
            ...(recipient.customVars || {}),
        });
        recipient.interpolatedMessage = interpolatedText;

        // ── Fault-Tolerant Per-Message Delivery with Auto-Retries & Cross-Session Failover ──
        let sentOk = false;
        let lastError = "";
        let attempts = 0;
        const maxRetries = campaign.faultTolerance?.maxRetries ?? 2;
        let lastFailedSession: string | undefined;

        while (attempts <= maxRetries && !sentOk && !campaign.isStopped && !campaign.isPaused) {
            attempts++;
            recipient.retries = attempts - 1;

            // Pick a live session (prioritize failover away from last failed session)
            let pick = pickLiveSession(
                resolvedSessions,
                attempts > 1 ? (sessionIndex + 1) % resolvedSessions.length : sessionIndex,
                lastFailedSession
            );

            // ── Self-Healing Grace Period: If all sessions temporarily disconnected ──
            if (!pick) {
                campaign.status = "reconnecting";
                campaign.reconnectMessage = "All WhatsApp sessions disconnected. Waiting for connection recovery (up to 60s)...";
                emitProgress(campaign, { status: "reconnecting", reconnectMessage: campaign.reconnectMessage });

                let recovered = false;
                const startWait = Date.now();
                const timeoutMs = campaign.faultTolerance?.autoReconnectTimeoutMs || 60000;

                while (Date.now() - startWait < timeoutMs && !campaign.isStopped && !campaign.isPaused) {
                    await new Promise((r) => setTimeout(r, 3000));
                    const testPick = pickLiveSession(resolvedSessions, sessionIndex);
                    if (testPick) {
                        recovered = true;
                        pick = testPick;
                        campaign.status = "running";
                        campaign.reconnectMessage = undefined;
                        campaign.faultStats.reconnectPauses++;
                        emitProgress(campaign, { status: "running", reconnectMessage: null });
                        break;
                    }
                    const elapsed = Math.round((Date.now() - startWait) / 1000);
                    campaign.reconnectMessage = `Reconnecting session... (${elapsed}s / 60s)`;
                    emitProgress(campaign, { status: "reconnecting", reconnectMessage: campaign.reconnectMessage });
                }

                if (!recovered || !pick) {
                    // Grace period expired without any session recovering:
                    // Automatically PAUSE campaign safely so user can reconnect session and resume!
                    campaign.status = "paused";
                    campaign.isPaused = true;
                    campaign.reconnectMessage = "Campaign paused: No WhatsApp sessions connected. Connect a session and click Resume.";
                    await saveBulkCampaign({
                        id: campaign.broadcastId,
                        broadcastId: campaign.broadcastId,
                        campaignName: campaign.campaignName,
                        status: "paused",
                        total: campaign.total,
                        sent: campaign.sent,
                        failed: campaign.failed,
                        sessionsUsed: resolvedSessions,
                        messageTemplate: campaign.messageTemplate,
                        mediaUrl: campaign.mediaUrl,
                        mediaType: campaign.mediaType,
                        fileName: campaign.fileName,
                        delay: campaign.delay,
                        rotateEvery: campaign.rotateEvery,
                        antiBan: campaign.antiBan,
                        startedAt: campaign.startedAt,
                        perSessionCount: { ...campaign.perSessionCount },
                        errors: campaign.errors,
                        recipients: campaign.recipients,
                        source: campaign.source,
                        faultTolerance: campaign.faultTolerance,
                        faultStats: campaign.faultStats,
                        reconnectMessage: campaign.reconnectMessage,
                    });
                    emitProgress(campaign, { status: "paused", reconnectMessage: campaign.reconnectMessage });
                    return;
                }
            }

            const currentSessionId = pick.sessionId;
            sessionIndex = pick.index;
            campaign.current = jid;
            campaign.currentSession = currentSessionId;
            const instance = waManager.getInstance(currentSessionId);

            try {
                if (!instance?.socket) throw new Error(`Session ${currentSessionId} socket disconnected`);
                
                let content: any = { text: interpolatedText };

                if (campaign.mediaUrl) {
                    try {
                        let mediaBuffer: Buffer;
                        let mimeType = "application/octet-stream";

                        if (campaign.mediaUrl.startsWith("data:")) {
                            const parts = campaign.mediaUrl.split(",");
                            const match = parts[0].match(/:(.*?);/);
                            if (match) mimeType = match[1];
                            mediaBuffer = Buffer.from(parts[1], "base64");
                        } else {
                            const res = await fetch(campaign.mediaUrl);
                            if (!res.ok) throw new Error(`HTTP ${res.status} downloading media`);
                            const ct = res.headers.get("content-type");
                            if (ct) mimeType = ct;
                            mediaBuffer = Buffer.from(await res.arrayBuffer());
                        }

                        const type = campaign.mediaType || (mimeType.startsWith("video") ? "video" : mimeType.startsWith("image") ? "image" : "document");

                        if (type === "video") {
                            content = { video: mediaBuffer, caption: interpolatedText };
                        } else if (type === "document") {
                            content = {
                                document: mediaBuffer,
                                caption: interpolatedText,
                                mimetype: mimeType,
                                fileName: campaign.fileName || campaign.mediaUrl.split("/").pop()?.split("?")[0] || "attachment.pdf"
                            };
                        } else {
                            content = { image: mediaBuffer, caption: interpolatedText };
                        }
                    } catch (mediaErr: any) {
                        console.error("Failed to prepare media attachment, falling back to text:", mediaErr);
                        content = { text: interpolatedText };
                    }
                }

                if (campaign.antiBan) {
                    try {
                        await antiban.humanize(instance.socket, currentSessionId, jid, content);
                    } catch (humanizeErr) {
                        console.warn("Anti-ban warning (non-fatal):", humanizeErr);
                    }
                }

                await instance.socket.sendMessage(jid, content);

                sentOk = true;
                campaign.sent++;
                recipient.status = "sent";
                recipient.sentAt = new Date().toISOString();
                recipient.sessionUsed = currentSessionId;
                campaign.perSessionCount[currentSessionId] = (campaign.perSessionCount[currentSessionId] || 0) + 1;
                msgsSinceRotate++;

                if (attempts > 1) {
                    campaign.faultStats.retriesRecovered++;
                }

                if (recipient.leadId) {
                    markLeadContacted(recipient.leadId).catch(() => {});
                }
            } catch (e: any) {
                lastError = e?.output?.payload?.message || e?.message || "Delivery failed";
                lastFailedSession = currentSessionId;

                // Rate-limit backpressure detection
                const isRateLimit = /rate-overlimit|resource-limit|flood|rate-limit|429|428/i.test(lastError);
                if (isRateLimit) {
                    campaign.faultStats.rateLimitPauses++;
                    const cooldown = campaign.faultTolerance?.rateLimitCooldownMs || 25000;
                    campaign.reconnectMessage = `Rate limit detected. Cooling down for ${Math.round(cooldown / 1000)}s...`;
                    emitProgress(campaign, { reconnectMessage: campaign.reconnectMessage });
                    await new Promise((r) => setTimeout(r, cooldown));
                    campaign.reconnectMessage = undefined;
                }

                // If retries remain, switch session and apply backoff jitter
                if (attempts <= maxRetries) {
                    campaign.faultStats.failoverSwitches++;
                    const backoff = (campaign.faultTolerance?.retryDelayMs || 2000) * attempts;
                    await new Promise((r) => setTimeout(r, backoff));
                    sessionIndex = (sessionIndex + 1) % resolvedSessions.length;
                }
            }
        }

        // If message failed even after all retry attempts across sessions
        if (!sentOk && !campaign.isStopped && !campaign.isPaused) {
            campaign.failed++;
            recipient.status = "failed";
            recipient.error = lastError;
            recipient.sessionUsed = lastFailedSession;

            campaign.errors.push({
                jid,
                error: lastError,
                session: lastFailedSession || "unknown",
                phone: recipient.phone,
                name: recipient.name,
                attempts,
            });

            sessionIndex = (sessionIndex + 1) % resolvedSessions.length;
            msgsSinceRotate = 0;
        }

        emitProgress(campaign, { current: jid, currentSession: campaign.currentSession });

        // Periodic checkpoint save every 5 messages
        if (i % 5 === 0) {
            saveBulkCampaign({
                id: campaign.broadcastId,
                broadcastId: campaign.broadcastId,
                campaignName: campaign.campaignName,
                status: campaign.status,
                total: campaign.total,
                sent: campaign.sent,
                failed: campaign.failed,
                sessionsUsed: resolvedSessions,
                messageTemplate: campaign.messageTemplate,
                mediaUrl: campaign.mediaUrl,
                mediaType: campaign.mediaType,
                fileName: campaign.fileName,
                delay: campaign.delay,
                rotateEvery: campaign.rotateEvery,
                antiBan: campaign.antiBan,
                startedAt: campaign.startedAt,
                perSessionCount: { ...campaign.perSessionCount },
                errors: campaign.errors,
                recipients: campaign.recipients,
                source: campaign.source,
                faultTolerance: campaign.faultTolerance,
                faultStats: campaign.faultStats,
                reconnectMessage: campaign.reconnectMessage,
            }).catch(() => {});
        }

        if (i < campaign.recipients.length - 1 && !campaign.isStopped && !campaign.isPaused) {
            await new Promise((r) => setTimeout(r, jitter(Math.max(500, campaign.delay))));
        }
    }

    // Determine final status
    if (campaign.isStopped) {
        campaign.status = "stopped";
    } else if (campaign.isPaused) {
        campaign.status = "paused";
    } else {
        campaign.status = "completed";
    }

    campaign.completedAt = campaign.status === "completed" || campaign.status === "stopped" ? new Date().toISOString() : undefined;
    campaign.current = null;

    // Final persistent save of the campaign record
    await saveBulkCampaign({
        id: campaign.broadcastId,
        broadcastId: campaign.broadcastId,
        campaignName: campaign.campaignName,
        status: campaign.status,
        total: campaign.total,
        sent: campaign.sent,
        failed: campaign.failed,
        sessionsUsed: resolvedSessions,
        messageTemplate: campaign.messageTemplate,
        mediaUrl: campaign.mediaUrl,
        mediaType: campaign.mediaType,
        fileName: campaign.fileName,
        delay: campaign.delay,
        rotateEvery: campaign.rotateEvery,
        antiBan: campaign.antiBan,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        perSessionCount: { ...campaign.perSessionCount },
        errors: campaign.errors,
        recipients: campaign.recipients,
        source: campaign.source,
        faultTolerance: campaign.faultTolerance,
        faultStats: campaign.faultStats,
        reconnectMessage: campaign.reconnectMessage,
    });

    emitProgress(campaign, { completedAt: campaign.completedAt });

    // Auto-remove completed/stopped campaigns from active memory after 20 minutes
    if (campaign.status === "completed" || campaign.status === "stopped") {
        setTimeout(() => activeCampaigns.delete(campaign.broadcastId), 20 * 60 * 1000);
    }
}

// ─── GET: List active campaigns, query history, or single campaign ───────────

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const activeIds = new Set(activeCampaigns.keys());

        // History query
        if (searchParams.get("history") === "true") {
            const history = await getBulkCampaigns(activeIds);
            return NextResponse.json({ status: true, data: history });
        }

        // Single campaign by broadcastId
        const broadcastId = searchParams.get("broadcastId");
        if (broadcastId) {
            const active = activeCampaigns.get(broadcastId);
            if (active) {
                const { stop: _s, pause: _p, resume: _r, ...c } = active;
                return NextResponse.json({
                    status: true,
                    data: {
                        ...c,
                        progress: Math.round(((c.sent + c.failed) / (c.total || 1)) * 100),
                    },
                });
            }

            const saved = await getBulkCampaign(broadcastId);
            if (saved) {
                return NextResponse.json({
                    status: true,
                    data: {
                        ...saved,
                        progress: Math.round(((saved.sent + saved.failed) / (saved.total || 1)) * 100),
                    },
                });
            }

            return NextResponse.json({ status: false, message: "Campaign not found" }, { status: 404 });
        }

        // Default: active campaigns + recent saved
        const list = Array.from(activeCampaigns.values()).map(({ stop: _s, pause: _p, resume: _r, ...c }) => ({
            ...c,
            progress: Math.round(((c.sent + c.failed) / (c.total || 1)) * 100),
        }));
        const history = await getBulkCampaigns(activeIds);

        return NextResponse.json({ status: true, data: list, history: history.slice(0, 30) });
    } catch (e: any) {
        console.error("Failed to list campaigns:", e);
        return NextResponse.json({ status: false, message: "Failed to list campaigns" }, { status: 500 });
    }
}

// ─── DELETE: Stop running campaign or delete from history ────────────────────

export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const broadcastId = searchParams.get("broadcastId");
        const action = searchParams.get("action");

        if (!broadcastId) {
            return NextResponse.json({ status: false, message: "broadcastId required" }, { status: 400 });
        }

        // Action: delete saved campaign from history
        if (action === "delete_history") {
            const ok = await deleteBulkCampaign(broadcastId);
            activeCampaigns.delete(broadcastId);
            return NextResponse.json({ status: ok, message: ok ? "Campaign deleted from history" : "Not found" });
        }

        // Stop running/paused campaign
        const campaign = activeCampaigns.get(broadcastId);
        if (campaign) {
            campaign.isStopped = true;
            campaign.isPaused = false;
            campaign.status = "stopped";
            campaign.completedAt = new Date().toISOString();

            await saveBulkCampaign({
                id: campaign.broadcastId,
                broadcastId: campaign.broadcastId,
                campaignName: campaign.campaignName,
                status: "stopped",
                total: campaign.total,
                sent: campaign.sent,
                failed: campaign.failed,
                sessionsUsed: campaign.sessionsUsed,
                messageTemplate: campaign.messageTemplate,
                mediaUrl: campaign.mediaUrl,
                mediaType: campaign.mediaType,
                fileName: campaign.fileName,
                delay: campaign.delay,
                rotateEvery: campaign.rotateEvery,
                antiBan: campaign.antiBan,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt,
                perSessionCount: campaign.perSessionCount,
                errors: campaign.errors,
                recipients: campaign.recipients,
                source: campaign.source,
                faultTolerance: campaign.faultTolerance,
                faultStats: campaign.faultStats,
            });

            emitProgress(campaign);
            return NextResponse.json({ status: true, message: "Campaign stopped" });
        }

        // If not in active memory, check saved record
        const saved = await getBulkCampaign(broadcastId);
        if (saved && (saved.status === "running" || saved.status === "paused" || saved.status === "reconnecting")) {
            saved.status = "stopped";
            saved.completedAt = new Date().toISOString();
            await saveBulkCampaign(saved);
            return NextResponse.json({ status: true, message: "Campaign marked as stopped" });
        }

        return NextResponse.json({ status: false, message: "Active campaign not found" }, { status: 404 });
    } catch (e: any) {
        console.error("Failed to stop/delete campaign:", e);
        return NextResponse.json({ status: false, message: "Failed to process request" }, { status: 500 });
    }
}

// ─── POST: Launch Campaign, Pause, or Resume ──────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ status: false, message: "Invalid JSON request payload" }, { status: 400 });
        }
        const action = body?.action || "start";

        // ── Action: PAUSE ─────────────────────────────────────────────────────
        if (action === "pause") {
            const { broadcastId } = body;
            if (!broadcastId) return NextResponse.json({ status: false, message: "broadcastId is required" }, { status: 400 });

            const campaign = activeCampaigns.get(broadcastId);
            if (!campaign) {
                return NextResponse.json({ status: false, message: "Active campaign not found" }, { status: 404 });
            }

            campaign.isPaused = true;
            campaign.status = "paused";
            campaign.reconnectMessage = "Campaign paused by user. Click Resume to continue.";
            emitProgress(campaign);

            await saveBulkCampaign({
                id: campaign.broadcastId,
                broadcastId: campaign.broadcastId,
                campaignName: campaign.campaignName,
                status: "paused",
                total: campaign.total,
                sent: campaign.sent,
                failed: campaign.failed,
                sessionsUsed: campaign.sessionsUsed,
                messageTemplate: campaign.messageTemplate,
                delay: campaign.delay,
                rotateEvery: campaign.rotateEvery,
                antiBan: campaign.antiBan,
                startedAt: campaign.startedAt,
                perSessionCount: { ...campaign.perSessionCount },
                errors: campaign.errors,
                recipients: campaign.recipients,
                source: campaign.source,
                faultTolerance: campaign.faultTolerance,
                faultStats: campaign.faultStats,
                reconnectMessage: campaign.reconnectMessage,
            });

            return NextResponse.json({ status: true, message: "Campaign paused successfully" });
        }

        // ── Action: RESUME ────────────────────────────────────────────────────
        if (action === "resume") {
            const { broadcastId } = body;
            if (!broadcastId) return NextResponse.json({ status: false, message: "broadcastId is required" }, { status: 400 });

            let campaign = activeCampaigns.get(broadcastId);

            // If not in memory (e.g. server restart), restore from persistent history!
            if (!campaign) {
                const saved = await getBulkCampaign(broadcastId);
                if (!saved) {
                    return NextResponse.json({ status: false, message: "Campaign not found" }, { status: 404 });
                }

                campaign = {
                    broadcastId: saved.broadcastId,
                    campaignName: saved.campaignName,
                    status: "running",
                    total: saved.total,
                    sent: saved.sent,
                    failed: saved.failed,
                    sessionsUsed: saved.sessionsUsed,
                    startedAt: saved.startedAt,
                    messageTemplate: saved.messageTemplate,
                    mediaUrl: saved.mediaUrl,
                    mediaType: saved.mediaType,
                    fileName: saved.fileName,
                    delay: saved.delay || 3000,
                    rotateEvery: saved.rotateEvery || 10,
                    antiBan: saved.antiBan ?? true,
                    errors: saved.errors || [],
                    perSessionCount: saved.perSessionCount || {},
                    recipients: saved.recipients || [],
                    source: saved.source,
                    faultTolerance: saved.faultTolerance || DEFAULT_FAULT_TOLERANCE,
                    faultStats: saved.faultStats || { retriesRecovered: 0, failoverSwitches: 0, reconnectPauses: 0, rateLimitPauses: 0 },
                    isStopped: false,
                    isPaused: false,
                };
                activeCampaigns.set(broadcastId, campaign);
            }

            // Verify at least one session is live
            const livePick = pickLiveSession(campaign.sessionsUsed, 0);
            if (!livePick) {
                return NextResponse.json({
                    status: false,
                    message: "Cannot resume: none of the campaign sessions are currently connected",
                }, { status: 503 });
            }

            campaign.isPaused = false;
            campaign.isStopped = false;
            campaign.status = "running";
            campaign.reconnectMessage = undefined;
            emitProgress(campaign);

            // Re-run worker from remaining pending recipients
            runCampaignWorker(campaign).catch((err) => {
                console.error("Campaign resumed worker error:", err);
            });

            return NextResponse.json({ status: true, message: "Campaign resumed successfully", data: { broadcastId } });
        }

        // ── Action: START NEW CAMPAIGN ────────────────────────────────────────
        const {
            sessions = [],
            recipients = [],
            message = "",
            mediaUrl,
            mediaType,
            fileName,
            delay = 3000,
            rotateEvery = 10,
            antiBan = true,
            campaignName = "Bulk Campaign",
            source = "manual",
            faultTolerance: customFaultTolerance,
        } = body;

        // Validation
        if (!Array.isArray(sessions) || sessions.length === 0) {
            return NextResponse.json({ status: false, message: "At least one session is required" }, { status: 400 });
        }
        if (!Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ status: false, message: "Recipients list is empty" }, { status: 400 });
        }
        if (!message.trim()) {
            return NextResponse.json({ status: false, message: "Message cannot be empty" }, { status: 400 });
        }

        // Resolve sessions to actual WhatsApp sessionId
        const resolvedSessions: string[] = [];
        for (const sid of sessions) {
            const dbSession = await prisma.session.findFirst({
                where: { OR: [{ id: sid }, { sessionId: sid }] },
                select: { sessionId: true }
            });
            const actualSid = dbSession?.sessionId || sid;
            if (!resolvedSessions.includes(actualSid)) {
                resolvedSessions.push(actualSid);
            }
        }

        // Auth per session
        for (const sid of resolvedSessions) {
            const ok = await canAccessSession(user.id, user.role, sid);
            if (!ok) {
                return NextResponse.json({ status: false, message: `Forbidden: no access to session ${sid}` }, { status: 403 });
            }
        }

        // Auto-recover / initialize any session instances that exist in DB but aren't loaded in memory yet
        for (const sid of resolvedSessions) {
            let inst = waManager.getInstance(sid);
            if (!inst || !inst.socket) {
                try {
                    const dbSession = await prisma.session.findUnique({ where: { sessionId: sid } });
                    if (dbSession && dbSession.status !== "STOPPED") {
                        const creds = await prisma.authState.findUnique({
                            where: { sessionId_key: { sessionId: sid, key: "creds-me" } }
                        });
                        if (creds) {
                            console.log(`[BulkMessenger] Auto-recovering session instance ${sid}...`);
                            await waManager.startSession(sid);
                            // Brief wait for socket attachment
                            for (let w = 0; w < 6; w++) {
                                inst = waManager.getInstance(sid);
                                if (inst?.socket) break;
                                await new Promise((r) => setTimeout(r, 400));
                            }
                        }
                    }
                } catch (recErr) {
                    console.warn(`[BulkMessenger] Could not auto-recover session ${sid}:`, recErr);
                }
            }
        }

        // Verify at least one session is live
        const initialConnected = resolvedSessions.filter((sid: string) => {
            const inst = waManager.getInstance(sid);
            return !!inst?.socket;
        });

        if (initialConnected.length === 0) {
            const dbSessions = await prisma.session.findMany({
                where: { sessionId: { in: resolvedSessions } },
                select: { name: true, sessionId: true, status: true }
            });
            const stopped = dbSessions.filter((s) => s.status === "STOPPED");
            const needsQR = dbSessions.filter((s) => s.status === "SCAN_QR");
            const loggedOut = dbSessions.filter((s) => s.status === "LOGGED_OUT");

            let detailMsg = "None of the selected sessions are connected";
            if (stopped.length > 0) {
                detailMsg = `Session "${stopped[0].name}" is stopped. Please start the session in Sessions / QR first.`;
            } else if (needsQR.length > 0) {
                detailMsg = `Session "${needsQR[0].name}" is waiting for QR scan. Please scan QR in Sessions / QR.`;
            } else if (loggedOut.length > 0) {
                detailMsg = `Session "${loggedOut[0].name}" was logged out. Please re-authenticate in Sessions / QR.`;
            } else {
                detailMsg = "None of the selected WhatsApp sessions are currently active. Please verify your connection in Sessions / QR.";
            }

            return NextResponse.json({ status: false, message: detailMsg }, { status: 503 });
        }

        // Normalize recipients to structured BulkRecipientItem list
        const recipientItems: BulkRecipientItem[] = [];

        for (const r of recipients) {
            if (typeof r === "string") {
                const jid = formatPhoneToJid(r);
                if (jid) {
                    recipientItems.push({
                        phone: r.replace(/\D/g, "") || jid.replace("@s.whatsapp.net", ""),
                        jid,
                        name: "",
                        status: "pending",
                        retries: 0,
                    });
                }
            } else if (r && typeof r === "object") {
                const rawPhone = r.formattedPhone || r.phone || r.jid || "";
                const jid = formatPhoneToJid(rawPhone);
                if (jid) {
                    recipientItems.push({
                        phone: rawPhone.replace(/\D/g, "") || jid.replace("@s.whatsapp.net", ""),
                        jid,
                        name: r.name || "",
                        category: r.category || "",
                        city: r.city || "",
                        state: r.state || "",
                        address: r.address || "",
                        website: r.website || "",
                        company: r.company || "",
                        leadId: r.id || r.leadId || undefined,
                        customVars: r.customVars || {},
                        status: "pending",
                        retries: 0,
                    });
                }
            }
        }

        if (recipientItems.length === 0) {
            return NextResponse.json({ status: false, message: "No valid recipient phone numbers provided" }, { status: 400 });
        }

        const total = recipientItems.length;
        const broadcastId = `bulk_${Date.now()}`;

        // Build initial per-session count map
        const perSessionCount: Record<string, number> = {};
        for (const sid of resolvedSessions) perSessionCount[sid] = 0;

        const faultToleranceConfig: FaultToleranceConfig = {
            ...DEFAULT_FAULT_TOLERANCE,
            ...(customFaultTolerance || {}),
        };

        const faultStats: FaultToleranceStats = {
            retriesRecovered: 0,
            failoverSwitches: 0,
            reconnectPauses: 0,
            rateLimitPauses: 0,
        };

        // Campaign State
        const campaign: ActiveCampaignState = {
            broadcastId,
            campaignName: campaignName.trim(),
            status: "running",
            total,
            sent: 0,
            failed: 0,
            sessionsUsed: resolvedSessions,
            startedAt: new Date().toISOString(),
            messageTemplate: message.trim(),
            mediaUrl: mediaUrl || undefined,
            mediaType: mediaType || undefined,
            fileName: fileName || undefined,
            delay,
            rotateEvery,
            antiBan,
            errors: [],
            perSessionCount,
            current: null,
            currentSession: initialConnected[0],
            recipients: recipientItems,
            source,
            faultTolerance: faultToleranceConfig,
            faultStats,
            isStopped: false,
            isPaused: false,
        };
        activeCampaigns.set(broadcastId, campaign);

        // Save initial record to persistent history
        const initialRecord: BulkCampaignRecord = {
            id: broadcastId,
            broadcastId,
            campaignName: campaign.campaignName,
            status: "running",
            total,
            sent: 0,
            failed: 0,
            sessionsUsed: resolvedSessions,
            messageTemplate: campaign.messageTemplate,
            mediaUrl: campaign.mediaUrl,
            mediaType: campaign.mediaType,
            fileName: campaign.fileName,
            delay,
            rotateEvery,
            antiBan,
            startedAt: campaign.startedAt,
            perSessionCount: { ...campaign.perSessionCount },
            errors: [],
            recipients: campaign.recipients,
            source,
            faultTolerance: faultToleranceConfig,
            faultStats,
        };
        await saveBulkCampaign(initialRecord);

        // Emit initial progress
        emitProgress(campaign, { current: null, currentSession: initialConnected[0] });

        // Launch background fault-tolerant runner
        runCampaignWorker(campaign).catch((e) => {
            console.error("Bulk campaign runner error:", e);
        });

        return NextResponse.json({
            status: true,
            message: "Bulk campaign started with fault tolerance",
            data: {
                broadcastId,
                campaignName: campaign.campaignName,
                total,
                sessionsUsed: initialConnected.length,
                sessions: resolvedSessions,
                faultTolerance: faultToleranceConfig,
            },
        });
    } catch (e: any) {
        console.error("Bulk messenger error:", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to start bulk messenger" }, { status: 500 });
    }
}
