"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
    Radio, Shield, RotateCcw, Zap, Users, MessageSquare, Activity,
    ChevronDown, ChevronUp, Info, Square, ArrowRight, Layers,
    SwitchCamera, Timer, Keyboard, History, Eye, Trash2, UserCheck,
    Search, Sparkles, ChevronLeft, ChevronRight, Check, Copy,
    Pause, Play, LifeBuoy, WifiOff, Paperclip, FileText, Image as ImageIcon, Video as VideoIcon, Mic
} from "lucide-react";
import { toast } from "sonner";
import { createAppSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";
import { useSession } from "@/components/dashboard/session-provider";
import type { BulkCampaignRecord, BulkRecipientItem, CampaignStatus, FaultToleranceStats } from "@/lib/bulk/types";
import { interpolateMessage } from "@/lib/bulk/template";
import type { Lead } from "@/lib/crm/types";

interface BulkProgress {
    broadcastId: string;
    campaignName?: string;
    status: CampaignStatus;
    total: number;
    sent: number;
    failed: number;
    current?: string | null;
    currentSession?: string;
    progress?: number;
    errors?: { jid: string; error: string; session: string; phone?: string; name?: string; attempts?: number }[];
    perSessionCount?: Record<string, number>;
    startedAt?: string;
    completedAt?: string;
    faultStats?: FaultToleranceStats;
    reconnectMessage?: string;
}

interface SessionOption {
    id: string;
    sessionId: string;
    name: string;
    status: string;
}

type PageTab = "configure" | "live" | "history";

export default function BulkMessengerPage() {
    const { sessions, sessionId: activeSessionId } = useSession();
    const [tab, setTab] = useState<PageTab>("configure");

    // ─── Campaign Fields ───────────────────────────────────────────────────────
    const [campaignName, setCampaignName] = useState("Bulk Campaign " + new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }));
    const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
    const [contactsRaw, setContactsRaw] = useState("");
    const [personalizedLeads, setPersonalizedLeads] = useState<BulkRecipientItem[]>([]);
    const [message, setMessage] = useState("Hello {name},\n\nWe have an exclusive offer for your business! Let us know if you would like more details.\n\nBest regards,\nSupport Team");
    const [delay, setDelay] = useState([3000]);
    const [rotateEvery, setRotateEvery] = useState([10]);
    const [antiBan, setAntiBan] = useState(true);
    const [faultToleranceEnabled, setFaultToleranceEnabled] = useState(true);

    // ─── Media Attachment State ───────────────────────────────────────────────
    const [mediaUrl, setMediaUrl] = useState("");
    const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "document">("image");
    const [mediaFileName, setMediaFileName] = useState("");
    const [uploadingMedia, setUploadingMedia] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Render / Server limit check (up to 50MB)
        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 50MB limit.`);
            if (e.target) e.target.value = "";
            return;
        }

        let detectedType: "image" | "video" | "audio" | "document" = "image";
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (file.type.startsWith("video/") || [".mp4", ".mov", ".mkv", ".webm", ".3gp", ".avi"].includes(ext)) {
            detectedType = "video";
        } else if (file.type.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".opus", ".amr"].includes(ext)) {
            detectedType = "audio";
        } else if (file.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
            detectedType = "image";
        } else {
            detectedType = "document";
        }

        setMediaType(detectedType);
        setMediaFileName(file.name);
        setUploadingMedia(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/autobroadcast/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json().catch(() => ({ status: false, message: "Upload failed" }));
            if (data.status && (data.data?.fileUrl || data.data?.url)) {
                setMediaUrl(data.data.fileUrl || data.data.url);
                toast.success(`Attached "${file.name}" successfully!`);
            } else {
                setMediaUrl("");
                setMediaFileName("");
                toast.error(data.message || `Failed to upload "${file.name}".`);
            }
        } catch (err: any) {
            setMediaUrl("");
            setMediaFileName("");
            toast.error(err?.message || `Failed to upload "${file.name}"`);
        } finally {
            setUploadingMedia(false);
            if (e.target) e.target.value = "";
        }
    };

    // ─── Runtime / Live State ──────────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
    const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
    const [showErrors, setShowErrors] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // ─── CRM Lead Picker Modal ─────────────────────────────────────────────────
    const [crmModalOpen, setCrmModalOpen] = useState(false);
    const [crmLeads, setCrmLeads] = useState<Lead[]>([]);
    const [loadingCrm, setLoadingCrm] = useState(false);
    const [crmSearch, setCrmSearch] = useState("");
    const [crmStageFilter, setCrmStageFilter] = useState("ALL");
    const [crmSelectedLeadIds, setCrmSelectedLeadIds] = useState<string[]>([]);

    // ─── History State ─────────────────────────────────────────────────────────
    const [historyList, setHistoryList] = useState<BulkCampaignRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historySearch, setHistorySearch] = useState("");
    const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
    const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<BulkCampaignRecord | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailRecipientFilter, setDetailRecipientFilter] = useState<"ALL" | "sent" | "failed">("ALL");
    const [detailRecipientSearch, setDetailRecipientSearch] = useState("");

    // ─── Preview Recipient Index ───────────────────────────────────────────────
    const [previewIdx, setPreviewIdx] = useState(0);

    // ─── Initial Session & Prefill from CRM ─────────────────────────────────────
    useEffect(() => {
        if (activeSessionId && selectedSessions.length === 0) {
            setSelectedSessions([activeSessionId]);
        }

        if (typeof window !== "undefined") {
            // Check if full structured leads were transferred from CRM
            const prefillLeadsJson = sessionStorage.getItem("bulk_prefill_leads");
            if (prefillLeadsJson) {
                try {
                    const parsedLeads: Lead[] = JSON.parse(prefillLeadsJson);
                    if (Array.isArray(parsedLeads) && parsedLeads.length > 0) {
                        const items: BulkRecipientItem[] = parsedLeads.map((l) => ({
                            phone: l.formattedPhone || l.phone,
                            jid: l.whatsappJid || `${l.formattedPhone}@s.whatsapp.net`,
                            name: l.name || "",
                            city: l.city || "",
                            state: l.state || "",
                            category: l.category || "",
                            company: l.name || "",
                            website: l.website || "",
                            address: l.address || "",
                            leadId: l.id,
                            status: "pending",
                        }));
                        setPersonalizedLeads(items);
                        setCampaignName(`CRM Leads Campaign (${items.length} Leads)`);
                        sessionStorage.removeItem("bulk_prefill_leads");
                        sessionStorage.removeItem("bulk_prefill_contacts");
                        toast.success(`Loaded ${items.length} personalized leads from CRM!`);
                        return;
                    }
                } catch {
                    /* fallback */
                }
            }

            // Fallback: check raw string contacts
            const prefillRaw = sessionStorage.getItem("bulk_prefill_contacts");
            if (prefillRaw) {
                setContactsRaw(prefillRaw);
                sessionStorage.removeItem("bulk_prefill_contacts");
                toast.info("Imported contacts from CRM");
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSessionId]);

    // ─── Parse raw input into recipients ───────────────────────────────────────
    const parsedRawRecipients = useMemo(() => {
        if (!contactsRaw.trim()) return [];

        const lines = contactsRaw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
        const results: BulkRecipientItem[] = [];

        for (const line of lines) {
            if (/^(phone|mobile|number|contact)\s*[,;\t]/i.test(line)) continue;

            if (line.includes(",") || line.includes(";") || line.includes("\t")) {
                const parts = line.split(/[,;\t]+/).map((p) => p.replace(/["']/g, "").trim());
                const phonePart = parts.find((p) => p.replace(/\D/g, "").length >= 7) || parts[0];
                const cleanDigits = phonePart.replace(/\D/g, "");
                const namePart = parts.find((p) => p !== phonePart && /[a-zA-Z]/.test(p)) || "";
                const remaining = parts.filter((p) => p !== phonePart && p !== namePart);

                if (cleanDigits) {
                    results.push({
                        phone: cleanDigits,
                        jid: `${cleanDigits}@s.whatsapp.net`,
                        name: namePart,
                        city: remaining[0] || "",
                        category: remaining[1] || "",
                        status: "pending",
                    });
                }
            } else {
                const cleanDigits = line.replace(/["']/g, "").replace(/\D/g, "");
                if (cleanDigits.length >= 7) {
                    results.push({
                        phone: cleanDigits,
                        jid: `${cleanDigits}@s.whatsapp.net`,
                        name: "",
                        status: "pending",
                    });
                }
            }
        }
        return results;
    }, [contactsRaw]);

    const effectiveRecipients = useMemo(() => {
        if (personalizedLeads.length > 0) return personalizedLeads;
        return parsedRawRecipients;
    }, [personalizedLeads, parsedRawRecipients]);

    const recipientCount = effectiveRecipients.length;

    const hasPersonalizedData = useMemo(() => {
        return effectiveRecipients.some((r) => Boolean(r.name?.trim() || r.city?.trim() || r.category?.trim()));
    }, [effectiveRecipients]);

    // ─── Socket Connection for Real-time Progress ──────────────────────────────
    useEffect(() => {
        const socket = createAppSocket();
        socket.on("connect", () => {
            selectedSessions.forEach((sid) => socket.emit("join-session", sid));
        });
        socket.on("connect_error", () => {
            // Transient connection glitch, socket.io will auto-reconnect
        });

        socket.on("bulk.progress", (data: BulkProgress) => {
            if (activeBroadcastId && data.broadcastId && data.broadcastId !== activeBroadcastId) {
                return;
            }
            setBulkProgress(data);
            if (data.status === "completed") {
                setLoading(false);
                fetchHistory();
                if (data.failed === 0) toast.success(`Campaign completed! ${data.sent} messages delivered.`);
                else toast.warning(`Campaign finished: ${data.sent} sent, ${data.failed} failed.`);
            } else if (data.status === "stopped") {
                setLoading(false);
                fetchHistory();
                toast.info(`Campaign stopped. ${data.sent} sent.`);
            } else if (data.status === "paused") {
                setLoading(false);
                fetchHistory();
            }
        });

        socketRef.current = socket;
        return () => { socket.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSessions.join(","), activeBroadcastId]);

    // ─── HTTP Polling Fallback during live campaign ────────────────────────────
    useEffect(() => {
        if (!activeBroadcastId || tab !== "live") return;
        let isMounted = true;

        const pollCampaign = async () => {
            try {
                const res = await fetch(`/api/bulk-messenger?broadcastId=${activeBroadcastId}`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    if (data?.data) {
                        setBulkProgress(data.data);
                        if (data.data.status === "completed" || data.data.status === "stopped") {
                            setLoading(false);
                        }
                    }
                }
            } catch {
                /* non-fatal */
            }
        };

        pollCampaign();
        const interval = setInterval(pollCampaign, 1500);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeBroadcastId, tab]);

    // ─── Fetch Campaign History ────────────────────────────────────────────────
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch("/api/bulk-messenger?history=true");
            if (res.ok) {
                const data = await res.json();
                if (data.status) {
                    setHistoryList(data.data || []);
                }
            }
        } catch {
            /* ignore */
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // ─── Fetch CRM Leads for Picker ───────────────────────────────────────────
    const fetchCrmLeads = async () => {
        setLoadingCrm(true);
        try {
            const res = await fetch(`/api/crm/leads?limit=1000`);
            if (res.ok) {
                const data = await res.json();
                if (data.status) {
                    setCrmLeads(data.data.leads || []);
                }
            }
        } catch {
            toast.error("Failed to load CRM leads");
        } finally {
            setLoadingCrm(false);
        }
    };

    const handleOpenCrmPicker = () => {
        setCrmModalOpen(true);
        if (crmLeads.length === 0) {
            fetchCrmLeads();
        }
    };

    const filteredCrmLeads = useMemo(() => {
        return crmLeads.filter((l) => {
            const matchesStage = crmStageFilter === "ALL" || l.stage === crmStageFilter;
            const q = crmSearch.toLowerCase().trim();
            const matchesSearch = !q || (
                l.name.toLowerCase().includes(q) ||
                l.formattedPhone.includes(q) ||
                (l.city && l.city.toLowerCase().includes(q)) ||
                (l.category && l.category.toLowerCase().includes(q))
            );
            return matchesStage && matchesSearch;
        });
    }, [crmLeads, crmStageFilter, crmSearch]);

    const handleApplyCrmLeads = () => {
        const target = crmSelectedLeadIds.length > 0
            ? crmLeads.filter((l) => crmSelectedLeadIds.includes(l.id))
            : filteredCrmLeads;

        if (target.length === 0) {
            return toast.error("No leads selected");
        }

        const items: BulkRecipientItem[] = target.map((l) => ({
            phone: l.formattedPhone || l.phone,
            jid: l.whatsappJid || `${l.formattedPhone}@s.whatsapp.net`,
            name: l.name || "",
            city: l.city || "",
            state: l.state || "",
            category: l.category || "",
            company: l.name || "",
            website: l.website || "",
            address: l.address || "",
            leadId: l.id,
            status: "pending",
        }));

        setPersonalizedLeads(items);
        setContactsRaw("");
        setCrmModalOpen(false);
        toast.success(`Imported ${items.length} personalized leads from CRM!`);
    };

    const insertVariable = (varName: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setMessage((prev) => prev + ` {${varName}}`);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const placeholder = `{${varName}}`;
        const updated = text.substring(0, start) + placeholder + text.substring(end);
        setMessage(updated);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 50);
    };

    const sampleRecipient = useMemo(() => {
        if (effectiveRecipients.length > 0) {
            const safeIdx = Math.min(previewIdx, effectiveRecipients.length - 1);
            return effectiveRecipients[safeIdx];
        }
        return {
            name: "Rajesh Kumar",
            phone: "919935370814",
            city: "Lucknow",
            category: "Bakery & Cafe",
            company: "Royal Bakes",
            website: "www.royalbakes.com",
            address: "Hazratganj, Lucknow",
        };
    }, [effectiveRecipients, previewIdx]);

    const previewMessage = useMemo(() => {
        return interpolateMessage(message, {
            name: sampleRecipient.name,
            phone: sampleRecipient.phone,
            city: sampleRecipient.city,
            category: sampleRecipient.category,
            company: sampleRecipient.company,
            website: sampleRecipient.website,
            address: sampleRecipient.address,
        });
    }, [message, sampleRecipient]);

    const connectedSessions = (sessions as SessionOption[]).filter((s) => s.status === "CONNECTED");

    const toggleSession = (sid: string) =>
        setSelectedSessions((prev) => prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid]);
    const selectAll = () => setSelectedSessions(connectedSessions.map((s) => s.sessionId));
    const deselectAll = () => setSelectedSessions([]);

    const estimatedTime = () => {
        if (recipientCount === 0) return "—";
        const sCount = Math.max(1, selectedSessions.length);
        const totalSec = Math.ceil((recipientCount * delay[0]) / 1000 / sCount);
        if (totalSec < 60) return `~${totalSec}s`;
        if (totalSec < 3600) return `~${Math.ceil(totalSec / 60)}m`;
        return `~${(totalSec / 3600).toFixed(1)}h`;
    };

    const canStart = selectedSessions.length > 0 && recipientCount > 0 && message.trim().length > 0 && campaignName.trim().length > 0;

    // ─── Launch Campaign ───────────────────────────────────────────────────────
    const handleSend = async () => {
        if (!canStart) return;
        setLoading(true);
        setBulkProgress(null);
        setActiveBroadcastId(null);

        try {
            const res = await fetch("/api/bulk-messenger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessions: selectedSessions,
                    recipients: effectiveRecipients,
                    message: message.trim(),
                    mediaUrl: mediaUrl || undefined,
                    mediaType: mediaType || undefined,
                    fileName: mediaFileName || undefined,
                    delay: delay[0],
                    rotateEvery: rotateEvery[0],
                    antiBan,
                    campaignName: campaignName.trim(),
                    source: personalizedLeads.length > 0 ? "crm" : "manual",
                    faultTolerance: {
                        maxRetries: faultToleranceEnabled ? 2 : 0,
                        autoFailover: faultToleranceEnabled,
                        autoReconnectTimeoutMs: 60000,
                    },
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setActiveBroadcastId(data.data.broadcastId);
                setTab("live");
                fetchHistory();
                toast.info(`Campaign "${campaignName}" launched with Fault Tolerance enabled!`);
            } else {
                toast.error(data.message || "Failed to start campaign");
                setLoading(false);
            }
        } catch {
            toast.error("Network error while starting campaign");
            setLoading(false);
        }
    };

    // ─── Pause Campaign (Fault Tolerance) ──────────────────────────────────────
    const handlePause = async () => {
        if (!activeBroadcastId) return;
        try {
            const res = await fetch("/api/bulk-messenger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "pause", broadcastId: activeBroadcastId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.info("Campaign paused. You can resume anytime without losing progress.");
                fetchHistory();
            } else {
                toast.error(data.message || "Failed to pause campaign");
            }
        } catch {
            toast.error("Network error while pausing");
        }
    };

    // ─── Resume Campaign (Fault Tolerance) ─────────────────────────────────────
    const handleResume = async (broadcastId?: string) => {
        const targetId = broadcastId || activeBroadcastId;
        if (!targetId) return;
        try {
            const res = await fetch("/api/bulk-messenger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resume", broadcastId: targetId }),
            });
            const data = await res.json();
            if (res.ok) {
                setActiveBroadcastId(targetId);
                setTab("live");
                toast.success("Campaign resumed successfully!");
                fetchHistory();
            } else {
                toast.error(data.message || "Failed to resume campaign");
            }
        } catch {
            toast.error("Network error while resuming");
        }
    };

    // ─── Stop Campaign ─────────────────────────────────────────────────────────
    const handleStop = async () => {
        if (!activeBroadcastId) return;
        try {
            await fetch(`/api/bulk-messenger?broadcastId=${activeBroadcastId}`, { method: "DELETE" });
            fetchHistory();
            toast.info("Campaign stopped");
        } catch {
            toast.error("Failed to stop campaign");
        }
    };

    // ─── Retry Failed from History ─────────────────────────────────────────────
    const handleRetryFailed = (campaign: BulkCampaignRecord) => {
        const failedItems = campaign.recipients?.filter((r) => r.status === "failed") || [];
        if (failedItems.length === 0) {
            return toast.info("No failed recipients to retry in this campaign");
        }

        setPersonalizedLeads(failedItems.map((r) => ({ ...r, status: "pending", error: undefined })));
        setCampaignName(`Retry: ${campaign.campaignName}`);
        setMessage(campaign.messageTemplate);
        if (campaign.sessionsUsed?.length > 0) {
            setSelectedSessions(campaign.sessionsUsed);
        }
        setDetailModalOpen(false);
        setTab("configure");
        toast.success(`Loaded ${failedItems.length} failed recipients into new campaign!`);
    };

    // ─── Re-run / Clone Campaign ───────────────────────────────────────────────
    const handleRerunCampaign = (campaign: BulkCampaignRecord) => {
        if (campaign.recipients && campaign.recipients.length > 0) {
            setPersonalizedLeads(campaign.recipients.map((r) => ({ ...r, status: "pending", error: undefined })));
        } else {
            setContactsRaw(campaign.errors?.map((e) => e.phone || e.jid.replace("@s.whatsapp.net", "")).join("\n") || "");
        }
        setCampaignName(`${campaign.campaignName} (Copy)`);
        setMessage(campaign.messageTemplate);
        if (campaign.sessionsUsed?.length > 0) {
            setSelectedSessions(campaign.sessionsUsed);
        }
        setDetailModalOpen(false);
        setTab("configure");
        toast.info(`Campaign "${campaign.campaignName}" loaded into editor`);
    };

    // ─── Delete Campaign from History ──────────────────────────────────────────
    const handleDeleteCampaign = async (broadcastId: string) => {
        try {
            const res = await fetch(`/api/bulk-messenger?action=delete_history&broadcastId=${broadcastId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setHistoryList((prev) => prev.filter((c) => c.broadcastId !== broadcastId));
                if (selectedCampaignDetail?.broadcastId === broadcastId) {
                    setDetailModalOpen(false);
                }
                toast.success("Campaign deleted from history");
            }
        } catch {
            toast.error("Failed to delete campaign");
        }
    };

    const formatJid = (jid: string) =>
        jid?.replace("@s.whatsapp.net", "").replace("@g.us", " (Group)") ?? "-";

    const getSessionName = (sid: string) =>
        (sessions as SessionOption[]).find((s) => s.sessionId === sid)?.name ?? sid;

    const filteredHistory = useMemo(() => {
        return historyList.filter((c) => {
            const matchesStatus = historyStatusFilter === "ALL" || c.status === historyStatusFilter;
            const q = historySearch.toLowerCase().trim();
            const matchesSearch = !q || c.campaignName.toLowerCase().includes(q) || c.broadcastId.includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [historyList, historyStatusFilter, historySearch]);

    const historyStats = useMemo(() => {
        const totalCampaigns = historyList.length;
        const totalSent = historyList.reduce((acc, c) => acc + (c.sent || 0), 0);
        const totalFailed = historyList.reduce((acc, c) => acc + (c.failed || 0), 0);
        const totalAttempted = totalSent + totalFailed;
        const successRate = totalAttempted > 0 ? Math.round((totalSent / totalAttempted) * 100) : 100;
        return { totalCampaigns, totalSent, totalFailed, successRate };
    }, [historyList]);

    const modalRecipients = useMemo(() => {
        if (!selectedCampaignDetail?.recipients) return [];
        return selectedCampaignDetail.recipients.filter((r) => {
            const matchesStatus = detailRecipientFilter === "ALL" || r.status === detailRecipientFilter;
            const q = detailRecipientSearch.toLowerCase().trim();
            const matchesSearch = !q || (
                (r.name && r.name.toLowerCase().includes(q)) ||
                (r.phone && r.phone.includes(q)) ||
                (r.city && r.city.toLowerCase().includes(q))
            );
            return matchesStatus && matchesSearch;
        });
    }, [selectedCampaignDetail, detailRecipientFilter, detailRecipientSearch]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header & Tab Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/50 pb-5">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                        <Zap className="h-7 w-7 text-primary" /> Bulk Messenger &amp; Fault-Tolerant Engine
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Resilient WhatsApp broadcasting with auto-failover, socket reconnect grace period &amp; personalized lead messaging.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1.5 bg-muted/60 p-1.5 rounded-2xl border border-border/60">
                    <Button
                        variant={tab === "configure" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setTab("configure")}
                        className="rounded-xl font-medium gap-1.5 text-xs sm:text-sm"
                    >
                        <Send className="h-4 w-4" /> New Campaign
                    </Button>

                    <Button
                        variant={tab === "history" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                            setTab("history");
                            fetchHistory();
                        }}
                        className="rounded-xl font-medium gap-1.5 text-xs sm:text-sm"
                    >
                        <History className="h-4 w-4" /> History
                        {historyList.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                                {historyList.length}
                            </Badge>
                        )}
                    </Button>

                    {(activeBroadcastId || bulkProgress) && (
                        <Button
                            variant={tab === "live" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setTab("live")}
                            className="rounded-xl font-medium gap-1.5 text-xs sm:text-sm relative"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Live Progress
                        </Button>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 1: CONFIGURE / CREATE CAMPAIGN                                  */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {tab === "configure" && (
                <div className="space-y-6">
                    {/* Top KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-card rounded-2xl border border-border/60 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Recipients</p>
                                <p className="text-xl font-bold text-primary mt-0.5">{recipientCount}</p>
                            </div>
                            <Users className="h-6 w-6 text-primary/40" />
                        </div>

                        <div className="p-3.5 bg-card rounded-2xl border border-border/60 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Active Sessions</p>
                                <p className="text-xl font-bold text-blue-600 mt-0.5">{selectedSessions.length}</p>
                            </div>
                            <SwitchCamera className="h-6 w-6 text-blue-500/40" />
                        </div>

                        <div className="p-3.5 bg-card rounded-2xl border border-border/60 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Est. Completion</p>
                                <p className="text-xl font-bold text-amber-600 mt-0.5">{estimatedTime()}</p>
                            </div>
                            <Clock className="h-6 w-6 text-amber-500/40" />
                        </div>

                        <div className="p-3.5 bg-card rounded-2xl border border-border/60 shadow-xs flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Fault Tolerance</p>
                                <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                                    <LifeBuoy className="h-3.5 w-3.5" /> Auto-Heal (ON)
                                </p>
                            </div>
                            <Shield className="h-6 w-6 text-emerald-500/40" />
                        </div>
                    </div>

                    {/* Campaign Details Header */}
                    <Card className="rounded-2xl border-border/60 shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" /> Campaign Name
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Choose a recognizable name to track this campaign in history and analytics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="e.g. Diwali Mega Sale 2026"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                                disabled={loading}
                                className="max-w-md h-10 font-medium"
                            />
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                        {/* ── Left Column: Sessions, Anti-Ban & Fault Tolerance ── */}
                        <div className="space-y-6 lg:col-span-1">
                            {/* Session Picker */}
                            <Card className="rounded-2xl border-border/60 shadow-xs">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Users className="h-4 w-4 text-primary" /> WhatsApp Sessions
                                            {selectedSessions.length > 1 && (
                                                <Badge variant="secondary" className="text-[10px] font-normal">
                                                    <SwitchCamera className="h-3 w-3 mr-1" /> Rotation &amp; Failover
                                                </Badge>
                                            )}
                                        </CardTitle>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>All</Button>
                                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={deselectAll}>None</Button>
                                        </div>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Select sessions to rotate and act as failover backup if one session drops.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {connectedSessions.length === 0 ? (
                                        <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
                                            <Activity className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm font-medium">No connected sessions</p>
                                            <p className="text-xs mt-1">Connect a WhatsApp session in Sessions / QR first.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                            {connectedSessions.map((s) => {
                                                const checked = selectedSessions.includes(s.sessionId);
                                                const order = selectedSessions.indexOf(s.sessionId) + 1;
                                                return (
                                                    <label
                                                        key={s.sessionId}
                                                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                                            checked
                                                                ? "border-primary/50 bg-primary/5 shadow-xs"
                                                                : "border-border/40 hover:border-border/70 hover:bg-muted/30"
                                                        }`}
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={() => toggleSession(s.sessionId)}
                                                            className="shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="relative flex h-2 w-2 shrink-0">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                                </span>
                                                                <span className="text-sm font-semibold truncate">{s.name}</span>
                                                            </div>
                                                            <p className="text-[10px] font-mono text-muted-foreground truncate">{s.sessionId}</p>
                                                        </div>
                                                        {checked && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                                                                #{order}
                                                            </Badge>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Rotation Summary */}
                                    {selectedSessions.length > 1 && (
                                        <div className="mt-3 p-2.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40">
                                            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                                <SwitchCamera className="h-3.5 w-3.5 shrink-0" />
                                                Rotates every <span className="font-bold">{rotateEvery[0]}</span> msg(s) with automatic failover backup.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Fault Tolerance & Anti-Ban Settings */}
                            <Card className="rounded-2xl border-border/60 shadow-xs">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <LifeBuoy className="h-4 w-4 text-primary" /> Fault Tolerance &amp; Anti-Ban
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Fault Tolerance Toggle */}
                                    <div className="flex items-center justify-between p-3 rounded-xl border bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40">
                                        <div>
                                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                                <LifeBuoy className="h-3.5 w-3.5 text-blue-600" /> Auto-Retry &amp; Failover
                                            </p>
                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                Retries failed messages on alternate session
                                            </p>
                                        </div>
                                        <Switch checked={faultToleranceEnabled} onCheckedChange={setFaultToleranceEnabled} disabled={loading} />
                                    </div>

                                    {faultToleranceEnabled && (
                                        <div className="space-y-2 p-2.5 bg-muted/40 rounded-xl text-[11px] text-muted-foreground border border-border/40">
                                            <div className="flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                <span><strong>2x Auto-Retry</strong> with exponential backoff on socket errors</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                <span><strong>Session Failover:</strong> switches to healthy session on failure</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                <span><strong>60s Reconnect Grace Period:</strong> auto-heals on internet drops</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                <span><strong>Anti-Flood Cooldown:</strong> 25s backpressure if rate-limited</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Anti-Ban Humanizer */}
                                    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                        antiBan ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" : "bg-muted/30 border-border/40"
                                    }`}>
                                        <div>
                                            <p className={`text-sm font-medium ${antiBan ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}`}>
                                                Anti-Ban Humanizer
                                            </p>
                                            <p className={`text-xs ${antiBan ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60"}`}>
                                                Simulates typing presence + random jitter
                                            </p>
                                        </div>
                                        <Switch checked={antiBan} onCheckedChange={setAntiBan} disabled={loading} />
                                    </div>

                                    {/* Base Delay */}
                                    <div className="space-y-2">
                                        <Label className="text-sm flex items-center justify-between">
                                            <span>Base Delay per Message</span>
                                            <span className="font-mono text-primary font-bold">{(delay[0] / 1000).toFixed(1)}s</span>
                                        </Label>
                                        <Slider min={1000} max={25000} step={500} value={delay} onValueChange={setDelay} disabled={loading} />
                                        <p className="text-[11px] text-muted-foreground">±30% random jitter is applied automatically.</p>
                                    </div>

                                    {/* Rotate Every */}
                                    <div className="space-y-2">
                                        <Label className="text-sm flex items-center justify-between">
                                            <span>Switch Session Every</span>
                                            <span className="font-mono text-primary font-bold">{rotateEvery[0]} msgs</span>
                                        </Label>
                                        <Slider min={1} max={50} step={1} value={rotateEvery} onValueChange={setRotateEvery} disabled={loading} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* ── Right Column: Recipients, Personalization & Message ── */}
                        <div className="space-y-6 lg:col-span-2">
                            {/* Recipients Card */}
                            <Card className="rounded-2xl border-border/60 shadow-xs">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-primary" /> Recipients &amp; Leads
                                            {recipientCount > 0 && (
                                                <Badge variant="secondary" className="font-mono">
                                                    {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                                                </Badge>
                                            )}
                                            {hasPersonalizedData && (
                                                <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                                                    <Sparkles className="h-3 w-3 mr-1" /> Personalized
                                                </Badge>
                                            )}
                                        </CardTitle>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleOpenCrmPicker}
                                                className="h-8 gap-1.5 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                                            >
                                                <UserCheck className="h-3.5 w-3.5" /> Pick from CRM Leads
                                            </Button>

                                            {personalizedLeads.length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setPersonalizedLeads([]);
                                                        setContactsRaw("");
                                                    }}
                                                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                                >
                                                    Clear Leads
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Select leads directly from your CRM or paste comma-separated CSV (phone, name, city).
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* If structured CRM leads are loaded */}
                                    {personalizedLeads.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4 text-purple-600" />
                                                    <p className="text-xs text-purple-800 dark:text-purple-300 font-medium">
                                                        Loaded <span className="font-bold">{personalizedLeads.length}</span> personalized leads with variables ({`{name}`}, {`{city}`}, {`{category}`}).
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleOpenCrmPicker}
                                                    className="h-6 text-[11px] text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                                                >
                                                    Change Selection
                                                </Button>
                                            </div>

                                            {/* Preview of first leads */}
                                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                                                {personalizedLeads.slice(0, 15).map((l, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Badge variant="outline" className="font-mono text-[10px]">#{i + 1}</Badge>
                                                            <span className="font-semibold truncate">{l.name || "Customer"}</span>
                                                            <span className="font-mono text-muted-foreground text-[11px]">{l.phone}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {l.city && <Badge variant="secondary" className="text-[10px]">{l.city}</Badge>}
                                                            {l.category && <Badge variant="outline" className="text-[10px]">{l.category}</Badge>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {personalizedLeads.length > 15 && (
                                                    <p className="text-center text-xs text-muted-foreground py-1">
                                                        + {personalizedLeads.length - 15} more leads loaded
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <Textarea
                                            placeholder={"Paste phone numbers or CSV data:\n919876543210, Rajesh Kumar, Lucknow, Retail\n919935370814, Priya Verma, Delhi\n918877665544"}
                                            className="min-h-[140px] font-mono text-xs sm:text-sm"
                                            value={contactsRaw}
                                            onChange={(e) => setContactsRaw(e.target.value)}
                                            disabled={loading}
                                        />
                                    )}

                                    <p className="text-[11px] text-muted-foreground">
                                        💡 Tip: You can paste comma-separated CSV like <code className="font-mono bg-muted px-1 rounded">Phone, Name, City</code> to auto-personalize pasted contacts!
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Message Content & Personalization Variables */}
                            <Card className="rounded-2xl border-border/60 shadow-xs">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-primary" /> Personalized Message Content
                                        </CardTitle>
                                        <span className="text-xs text-muted-foreground font-mono">{message.length} characters</span>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Click any variable below to insert it at your cursor. Each recipient receives a customized message.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Variable Insert Chips */}
                                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-muted/40 rounded-xl border border-border/40">
                                        <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
                                            <Zap className="h-3 w-3 text-primary" /> Insert Tag:
                                        </span>
                                        {[
                                            { tag: "name", label: "Lead Name" },
                                            { tag: "phone", label: "Phone" },
                                            { tag: "city", label: "City" },
                                            { tag: "category", label: "Category" },
                                            { tag: "company", label: "Company" },
                                            { tag: "website", label: "Website" },
                                        ].map(({ tag }) => (
                                            <Button
                                                key={tag}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable(tag)}
                                                className="h-7 text-xs px-2.5 rounded-lg border-primary/20 hover:border-primary hover:bg-primary/5 font-mono"
                                            >
                                                +{`{${tag}}`}
                                            </Button>
                                        ))}
                                    </div>

                                    {/* Textarea */}
                                    <Textarea
                                        ref={textareaRef}
                                        placeholder={"Hello {name},\n\nWe noticed your business in {city} and wanted to offer..."}
                                        className="min-h-[140px] text-sm"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        disabled={loading}
                                    />

                                    {/* Media Attachment Card */}
                                    <div className="p-3.5 bg-muted/20 rounded-2xl border border-border/60 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold flex items-center gap-1.5 text-foreground">
                                                <Paperclip className="h-3.5 w-3.5 text-primary" /> Media Attachment (Optional)
                                            </span>
                                            {mediaUrl && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-xs text-destructive hover:text-destructive px-2"
                                                    onClick={() => {
                                                        setMediaUrl("");
                                                        setMediaFileName("");
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" /> Remove Media
                                                </Button>
                                            )}
                                        </div>

                                        {!mediaUrl ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-border hover:border-primary/60 rounded-xl cursor-pointer bg-background/50 hover:bg-muted/30 transition-colors text-xs text-muted-foreground font-medium">
                                                    <Paperclip className="h-4 w-4 text-primary" />
                                                    <span>{uploadingMedia ? "Uploading..." : "Upload Image / Video / Audio / Doc"}</span>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.mp4,.mov,.mkv,.webm,.3gp,.avi,.mp3,.wav,.ogg,.m4a,.aac,.opus,.amr"
                                                        onChange={handleFileUpload}
                                                        disabled={uploadingMedia || loading}
                                                    />
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        placeholder="Or paste Direct Media URL (https://...)"
                                                        className="h-9 text-xs"
                                                        value={mediaUrl}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setMediaUrl(val);
                                                            const lower = val.toLowerCase();
                                                            if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.endsWith(".webm") || lower.endsWith(".3gp") || lower.endsWith(".avi")) setMediaType("video");
                                                            else if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".m4a") || lower.endsWith(".opus") || lower.endsWith(".aac") || lower.endsWith(".amr")) setMediaType("audio");
                                                            else if (lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx")) setMediaType("document");
                                                            else setMediaType("image");
                                                        }}
                                                        disabled={loading}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-2.5 bg-background rounded-xl border border-primary/20 text-xs">
                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                        {mediaType === "video" ? (
                                                            <VideoIcon className="h-4 w-4" />
                                                        ) : mediaType === "audio" ? (
                                                            <Mic className="h-4 w-4" />
                                                        ) : mediaType === "document" ? (
                                                            <FileText className="h-4 w-4" />
                                                        ) : (
                                                            <ImageIcon className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="font-medium text-foreground truncate">{mediaFileName || "Attached Media"}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase">
                                                            {mediaType === "audio" ? "Voice / Audio note ready to send" : `${mediaType} ready to send with caption`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <select
                                                        className="h-7 text-xs bg-muted border border-border rounded px-1.5 text-foreground"
                                                        value={mediaType}
                                                        onChange={(e) => setMediaType(e.target.value as any)}
                                                    >
                                                        <option value="image">Image</option>
                                                        <option value="video">Video</option>
                                                        <option value="audio">Voice / Audio</option>
                                                        <option value="document">Document</option>
                                                    </select>
                                                    <Badge variant="secondary" className="text-[10px]">Attached</Badge>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Live Message Preview Box */}
                                    <div className="p-3.5 bg-muted/30 rounded-2xl border border-border/60 space-y-2">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span className="font-semibold flex items-center gap-1.5 text-foreground">
                                                <Eye className="h-3.5 w-3.5 text-primary" /> Live Preview for Recipient:
                                            </span>
                                            {recipientCount > 1 && (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => setPreviewIdx((p) => Math.max(0, p - 1))}
                                                        disabled={previewIdx <= 0}
                                                    >
                                                        <ChevronLeft className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <span className="font-mono text-[11px]">
                                                        {previewIdx + 1} / {recipientCount}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => setPreviewIdx((p) => Math.min(recipientCount - 1, p + 1))}
                                                        disabled={previewIdx >= recipientCount - 1}
                                                    >
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-[10px]">
                                                {sampleRecipient.phone}
                                            </Badge>
                                            {sampleRecipient.name && <span className="font-medium text-foreground">{sampleRecipient.name}</span>}
                                            {sampleRecipient.city && <span>({sampleRecipient.city})</span>}
                                        </div>

                                        {/* WhatsApp style preview bubble */}
                                        <div className="bg-[#E7FFDB] dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 p-3 rounded-2xl rounded-tl-none border border-emerald-200 dark:border-emerald-800/40 text-sm whitespace-pre-wrap font-sans shadow-xs space-y-2">
                                            {mediaUrl && (
                                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700/50 flex items-center gap-2 text-xs font-semibold">
                                                    {mediaType === "audio" ? (
                                                        <Mic className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                                                    ) : (
                                                        <Paperclip className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                                                    )}
                                                    <span>[{mediaType.toUpperCase()}]: {mediaFileName || "Attached File"}</span>
                                                </div>
                                            )}
                                            <div>{previewMessage || <span className="opacity-40 italic">Type a message above to see preview...</span>}</div>
                                        </div>
                                    </div>

                                    {/* Launch Button */}
                                    <Button
                                        className="w-full h-12 text-base font-bold rounded-2xl shadow-sm gap-2"
                                        onClick={handleSend}
                                        disabled={loading || !canStart}
                                    >
                                        {loading ? (
                                            <><RefreshCw className="h-5 w-5 animate-spin" /> Starting Campaign...</>
                                        ) : (
                                            <><Send className="h-5 w-5" /> Launch Fault-Tolerant Campaign ({recipientCount} Leads)</>
                                        )}
                                    </Button>

                                    {!canStart && (
                                        <div className="space-y-1 pt-1">
                                            {!campaignName.trim() && <p className="text-xs text-amber-600 dark:text-amber-400">• Enter a campaign name</p>}
                                            {selectedSessions.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">• Select at least one connected WhatsApp session</p>}
                                            {recipientCount === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">• Add recipients or select leads from CRM</p>}
                                            {!message.trim() && <p className="text-xs text-amber-600 dark:text-amber-400">• Message text cannot be empty</p>}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 2: LIVE RUNTIME PROGRESS (FAULT TOLERANT)                       */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {tab === "live" && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Live Header with Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                {bulkProgress?.status === "running" ? (
                                    <><Radio className="h-6 w-6 text-blue-500 animate-pulse" /> Live Campaign Execution</>
                                ) : bulkProgress?.status === "paused" ? (
                                    <><Pause className="h-6 w-6 text-amber-500" /> Campaign Paused</>
                                ) : bulkProgress?.status === "reconnecting" ? (
                                    <><WifiOff className="h-6 w-6 text-amber-500 animate-pulse" /> Reconnecting Sessions...</>
                                ) : bulkProgress?.status === "completed" ? (
                                    <><CheckCircle2 className="h-6 w-6 text-emerald-500" /> Campaign Completed</>
                                ) : (
                                    <><Square className="h-6 w-6 text-muted-foreground" /> Campaign Stopped</>
                                )}
                            </h2>
                            <p className="text-muted-foreground text-sm mt-1">
                                {bulkProgress?.campaignName || campaignName}
                                <span className="ml-2 font-mono text-xs opacity-60">ID: {activeBroadcastId}</span>
                            </p>
                        </div>

                        {/* Controls (Pause, Resume, Stop, New) */}
                        <div className="flex items-center gap-2">
                            {bulkProgress?.status === "running" && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePause}
                                        className="gap-1.5 rounded-xl border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                                    >
                                        <Pause className="h-3.5 w-3.5" /> Pause
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5 rounded-xl">
                                        <Square className="h-3.5 w-3.5" /> Stop
                                    </Button>
                                </>
                            )}

                            {bulkProgress?.status === "paused" && (
                                <>
                                    <Button
                                        size="sm"
                                        onClick={() => handleResume()}
                                        className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                    >
                                        <Play className="h-3.5 w-3.5" /> Resume Campaign
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5 rounded-xl">
                                        <Square className="h-3.5 w-3.5" /> Stop
                                    </Button>
                                </>
                            )}

                            {bulkProgress?.status === "reconnecting" && (
                                <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5 rounded-xl">
                                    <Square className="h-3.5 w-3.5" /> Stop
                                </Button>
                            )}

                            {bulkProgress && (bulkProgress.status === "completed" || bulkProgress.status === "stopped") && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setTab("history");
                                            fetchHistory();
                                        }}
                                        className="gap-1.5 rounded-xl"
                                    >
                                        <History className="h-3.5 w-3.5" /> View in History
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setTab("configure");
                                            setBulkProgress(null);
                                            setActiveBroadcastId(null);
                                            setLoading(false);
                                        }}
                                        className="gap-1.5 rounded-xl"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> New Campaign
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Reconnect / Alert Banner */}
                    {bulkProgress?.reconnectMessage && (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-700 dark:text-amber-300 text-sm">
                            <Activity className="h-4 w-4 animate-spin shrink-0 text-amber-500" />
                            <div className="flex-1 font-medium">{bulkProgress.reconnectMessage}</div>
                            {bulkProgress.status === "paused" && (
                                <Button
                                    size="sm"
                                    onClick={() => handleResume()}
                                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                                >
                                    Resume Now
                                </Button>
                            )}
                        </div>
                    )}

                    {!bulkProgress && (
                        <Card className="rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <RefreshCw className="h-10 w-10 animate-spin text-primary mb-3 opacity-60" />
                                <p className="text-sm text-muted-foreground">Waiting for campaign data…</p>
                            </CardContent>
                        </Card>
                    )}

                    {bulkProgress && (
                        <>
                            {/* Main Progress Card */}
                            <Card className={`rounded-2xl border-2 transition-colors ${
                                bulkProgress.status === "running" ? "border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/10"
                                : bulkProgress.status === "paused" ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                                : bulkProgress.status === "reconnecting" ? "border-amber-500/40 bg-amber-50/20"
                                : bulkProgress.status === "completed" && bulkProgress.failed === 0 ? "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10"
                                : "border-border/60"
                            }`}>
                                <CardContent className="pt-6 space-y-5">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                Delivery Progress
                                                {bulkProgress.status === "paused" && (
                                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">PAUSED</Badge>
                                                )}
                                            </span>
                                            <span className="font-mono font-bold">
                                                {bulkProgress.sent + bulkProgress.failed}/{bulkProgress.total} ({bulkProgress.progress ?? 0}%)
                                            </span>
                                        </div>
                                        <Progress value={bulkProgress.progress ?? 0} className="h-3.5 rounded-full" />
                                    </div>

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-background rounded-2xl p-4 text-center border shadow-xs">
                                            <div className="text-2xl font-bold text-emerald-600">{bulkProgress.sent}</div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Sent
                                            </div>
                                        </div>
                                        <div className="bg-background rounded-2xl p-4 text-center border shadow-xs">
                                            <div className="text-2xl font-bold text-red-500">{bulkProgress.failed}</div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                                <XCircle className="h-3.5 w-3.5 text-red-500" /> Failed
                                            </div>
                                        </div>
                                        <div className="bg-background rounded-2xl p-4 text-center border shadow-xs">
                                            <div className="text-2xl font-bold text-muted-foreground">
                                                {Math.max(0, bulkProgress.total - bulkProgress.sent - bulkProgress.failed)}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                                <Clock className="h-3.5 w-3.5" /> Pending
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active Target Banner */}
                                    {bulkProgress.status === "running" && bulkProgress.current && (
                                        <div className="flex items-center gap-2 text-xs px-3.5 py-2.5 bg-muted/60 rounded-xl">
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />
                                            <span className="text-muted-foreground">Sending to</span>
                                            <span className="font-mono font-semibold">{formatJid(bulkProgress.current)}</span>
                                            {bulkProgress.currentSession && (
                                                <Badge variant="outline" className="text-[10px] font-mono px-1.5 ml-auto shrink-0">
                                                    via {getSessionName(bulkProgress.currentSession)}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Fault Tolerance Real-Time Diagnostics Card */}
                            <Card className="rounded-2xl border-border/60 shadow-xs">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <LifeBuoy className="h-4 w-4 text-emerald-600" /> Fault Tolerance &amp; Resilience Monitor
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Live monitoring of automatic retries, cross-session failovers, and auto-reconnect cycles.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                        <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                                            <div className="text-lg font-bold text-emerald-600">
                                                {bulkProgress.faultStats?.retriesRecovered ?? 0}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">Retries Recovered</div>
                                        </div>

                                        <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                                            <div className="text-lg font-bold text-blue-600">
                                                {bulkProgress.faultStats?.failoverSwitches ?? 0}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">Failover Switches</div>
                                        </div>

                                        <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                                            <div className="text-lg font-bold text-amber-600">
                                                {bulkProgress.faultStats?.reconnectPauses ?? 0}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">Network Reconnects</div>
                                        </div>

                                        <div className="p-3 bg-muted/40 rounded-xl border border-border/40">
                                            <div className="text-lg font-bold text-purple-600">
                                                {bulkProgress.faultStats?.rateLimitPauses ?? 0}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">Anti-Flood Pauses</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Session Breakdown */}
                            {selectedSessions.length > 1 && bulkProgress.perSessionCount && (
                                <Card className="rounded-2xl border-border/60">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <SwitchCamera className="h-4 w-4 text-primary" /> Session Distribution
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2.5">
                                            {selectedSessions.map((sid, i) => {
                                                const count = bulkProgress.perSessionCount?.[sid] ?? 0;
                                                const total = bulkProgress.sent || 1;
                                                const pct = Math.round((count / total) * 100);
                                                const isActive = bulkProgress.currentSession === sid && bulkProgress.status === "running";
                                                return (
                                                    <div key={sid} className={`rounded-xl p-3 border ${isActive ? "border-blue-400 bg-blue-50/30 dark:bg-blue-950/20" : "border-border/40"}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold">{getSessionName(sid)}</span>
                                                                <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                                                            </div>
                                                            <span className="font-mono text-sm font-bold text-primary">{count} msgs</span>
                                                        </div>
                                                        <Progress value={pct} className="h-1.5" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Errors List */}
                            {(bulkProgress.errors?.length ?? 0) > 0 && (
                                <Card className="rounded-2xl border-red-500/20">
                                    <CardContent className="pt-4 space-y-2">
                                        <button
                                            onClick={() => setShowErrors(!showErrors)}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700"
                                        >
                                            <XCircle className="h-4 w-4" /> {bulkProgress.errors!.length} Delivery Failures
                                            {showErrors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                        </button>
                                        {showErrors && (
                                            <div className="max-h-48 overflow-y-auto bg-red-50/50 dark:bg-red-950/30 rounded-xl p-2.5 space-y-1.5">
                                                {bulkProgress.errors!.map((err, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs py-1.5 px-2 bg-background rounded-lg border gap-2">
                                                        <span className="font-mono shrink-0">{formatJid(err.jid)}</span>
                                                        {err.attempts && err.attempts > 1 && (
                                                            <Badge variant="outline" className="text-[9px] shrink-0">
                                                                {err.attempts} attempts
                                                            </Badge>
                                                        )}
                                                        <span className="text-red-500 truncate">{err.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* VIEW 3: CAMPAIGN HISTORY                                             */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {tab === "history" && (
                <div className="space-y-6">
                    {/* Stats summary banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 bg-card rounded-2xl border border-border/60 shadow-xs">
                            <p className="text-xs text-muted-foreground font-medium">Total Campaigns</p>
                            <p className="text-2xl font-bold text-primary mt-1">{historyStats.totalCampaigns}</p>
                        </div>
                        <div className="p-4 bg-card rounded-2xl border border-border/60 shadow-xs">
                            <p className="text-xs text-muted-foreground font-medium">Delivered Messages</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">{historyStats.totalSent}</p>
                        </div>
                        <div className="p-4 bg-card rounded-2xl border border-border/60 shadow-xs">
                            <p className="text-xs text-muted-foreground font-medium">Failed Messages</p>
                            <p className="text-2xl font-bold text-red-500 mt-1">{historyStats.totalFailed}</p>
                        </div>
                        <div className="p-4 bg-card rounded-2xl border border-border/60 shadow-xs">
                            <p className="text-xs text-muted-foreground font-medium">Overall Success Rate</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{historyStats.successRate}%</p>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <Card className="rounded-2xl border-border/60 shadow-xs">
                        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="relative flex-1 min-w-[240px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search campaigns by name or ID..."
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="pl-9 h-9 rounded-xl"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
                                    {["ALL", "completed", "paused", "stopped", "running"].map((st) => (
                                        <Button
                                            key={st}
                                            variant={historyStatusFilter === st ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setHistoryStatusFilter(st)}
                                            className="h-7 text-xs rounded-lg capitalize"
                                        >
                                            {st}
                                        </Button>
                                    ))}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchHistory}
                                    disabled={loadingHistory}
                                    className="h-9 rounded-xl gap-1.5"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} /> Refresh
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Campaign History Cards */}
                    {filteredHistory.length === 0 ? (
                        <Card className="rounded-2xl border-dashed">
                            <CardContent className="py-16 text-center text-muted-foreground">
                                <History className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-base font-semibold">No campaigns found in history</p>
                                <p className="text-xs mt-1">Run your first bulk messaging campaign to see history records here.</p>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setTab("configure")}
                                    className="mt-4 rounded-xl gap-1.5"
                                >
                                    <Send className="h-4 w-4" /> Start a Campaign
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {filteredHistory.map((camp) => {
                                const total = camp.total || 1;
                                const sent = camp.sent || 0;
                                const failed = camp.failed || 0;
                                const pct = Math.round(((sent + failed) / total) * 100);
                                const isPaused = camp.status === "paused";

                                return (
                                    <Card
                                        key={camp.broadcastId}
                                        className="rounded-2xl border-border/60 hover:border-border/90 transition-all shadow-xs"
                                    >
                                        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className="space-y-1.5 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-base truncate">{camp.campaignName}</span>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[10px] capitalize font-medium ${
                                                            camp.status === "completed"
                                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                                : camp.status === "paused"
                                                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                                                : camp.status === "running"
                                                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                                                : "bg-muted text-muted-foreground"
                                                        }`}
                                                    >
                                                        {camp.status}
                                                    </Badge>
                                                    {camp.source === "crm" && (
                                                        <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300">
                                                            CRM Leads
                                                        </Badge>
                                                    )}
                                                    {camp.faultStats && camp.faultStats.retriesRecovered > 0 && (
                                                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                                                            <LifeBuoy className="h-2.5 w-2.5 mr-1" /> {camp.faultStats.retriesRecovered} Rescued
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                    <span>
                                                        {new Date(camp.startedAt).toLocaleString("en-IN", {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{camp.sessionsUsed?.length || 1} session(s) used</span>
                                                    <span>•</span>
                                                    <span className="font-mono text-[11px] opacity-70">{camp.broadcastId}</span>
                                                </div>

                                                {/* Mini progress bar */}
                                                <div className="flex items-center gap-3 max-w-sm pt-1">
                                                    <Progress value={pct} className="h-2 rounded-full flex-1" />
                                                    <span className="text-xs font-mono font-medium">
                                                        <span className="text-emerald-600 font-bold">{sent}</span>/{total} sent
                                                        {failed > 0 && <span className="text-red-500 ml-1">({failed} err)</span>}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                                                {/* Prominent Resume Button for Paused Campaigns */}
                                                {isPaused && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleResume(camp.broadcastId)}
                                                        className="rounded-xl h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 font-bold"
                                                    >
                                                        <Play className="h-3.5 w-3.5" /> Resume
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedCampaignDetail(camp);
                                                        setDetailModalOpen(true);
                                                    }}
                                                    className="rounded-xl h-8 text-xs gap-1.5"
                                                >
                                                    <Eye className="h-3.5 w-3.5" /> View Logs
                                                </Button>

                                                {failed > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRetryFailed(camp)}
                                                        className="rounded-xl h-8 text-xs gap-1.5 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" /> Retry {failed} Failed
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRerunCampaign(camp)}
                                                    className="rounded-xl h-8 text-xs gap-1.5"
                                                >
                                                    <Copy className="h-3.5 w-3.5" /> Clone
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteCampaign(camp.broadcastId)}
                                                    className="rounded-xl h-8 text-xs text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: CAMPAIGN LOGS & RECIPIENT DETAILS                              */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-3xl">
                    <DialogHeader className="pb-2 border-b">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                    <History className="h-5 w-5 text-primary" /> {selectedCampaignDetail?.campaignName}
                                </DialogTitle>
                                <DialogDescription className="text-xs mt-0.5">
                                    Broadcast ID: <span className="font-mono">{selectedCampaignDetail?.broadcastId}</span>
                                </DialogDescription>
                            </div>
                            <Badge
                                variant="secondary"
                                className="capitalize font-semibold text-xs"
                            >
                                {selectedCampaignDetail?.status}
                            </Badge>
                        </div>
                    </DialogHeader>

                    {selectedCampaignDetail && (
                        <div className="space-y-4 py-3 flex-1 overflow-y-auto">
                            {/* Summary stat cards */}
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="p-3 bg-muted/40 rounded-xl text-center border">
                                    <div className="text-xl font-bold text-primary">{selectedCampaignDetail.total}</div>
                                    <div className="text-[11px] text-muted-foreground">Total Leads</div>
                                </div>
                                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl text-center border border-emerald-200 dark:border-emerald-800/40">
                                    <div className="text-xl font-bold text-emerald-600">{selectedCampaignDetail.sent}</div>
                                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Delivered</div>
                                </div>
                                <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-xl text-center border border-red-200 dark:border-red-800/40">
                                    <div className="text-xl font-bold text-red-500">{selectedCampaignDetail.failed}</div>
                                    <div className="text-[11px] text-red-700 dark:text-red-300">Failed</div>
                                </div>
                            </div>

                            {/* Fault Tolerance Stats if recorded */}
                            {selectedCampaignDetail.faultStats && (
                                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40 flex items-center justify-between text-xs">
                                    <span className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                        <LifeBuoy className="h-4 w-4 text-blue-600" /> Fault Tolerance:
                                    </span>
                                    <div className="flex gap-3 text-muted-foreground">
                                        <span><strong>{selectedCampaignDetail.faultStats.retriesRecovered}</strong> retries rescued</span>
                                        <span>•</span>
                                        <span><strong>{selectedCampaignDetail.faultStats.failoverSwitches}</strong> session failovers</span>
                                        <span>•</span>
                                        <span><strong>{selectedCampaignDetail.faultStats.reconnectPauses}</strong> reconnects</span>
                                    </div>
                                </div>
                            )}

                            {/* Template used */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-muted-foreground">Message Template Used</Label>
                                <div className="p-3 bg-muted/40 rounded-xl text-xs whitespace-pre-wrap font-sans border">
                                    {selectedCampaignDetail.messageTemplate}
                                </div>
                            </div>

                            {/* Recipient Search & Filters */}
                            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search recipients by name, phone..."
                                        value={detailRecipientSearch}
                                        onChange={(e) => setDetailRecipientSearch(e.target.value)}
                                        className="pl-8 h-8 text-xs rounded-xl"
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
                                    {(["ALL", "sent", "failed"] as const).map((filter) => (
                                        <Button
                                            key={filter}
                                            variant={detailRecipientFilter === filter ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setDetailRecipientFilter(filter)}
                                            className="h-6 text-[11px] px-2 rounded-lg capitalize"
                                        >
                                            {filter}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Recipients List Table */}
                            <div className="border rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-muted/70 border-b sticky top-0 font-semibold text-muted-foreground">
                                        <tr>
                                            <th className="p-2.5">Recipient</th>
                                            <th className="p-2.5">Status</th>
                                            <th className="p-2.5">Session</th>
                                            <th className="p-2.5">Personalized Message Preview</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {modalRecipients.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                                    No recipients match your filter
                                                </td>
                                            </tr>
                                        ) : (
                                            modalRecipients.map((rec, i) => (
                                                <tr key={i} className="hover:bg-muted/30">
                                                    <td className="p-2.5">
                                                        <div className="font-semibold">{rec.name || "Customer"}</div>
                                                        <div className="font-mono text-muted-foreground text-[10px]">{rec.phone}</div>
                                                        {rec.city && <div className="text-[10px] text-muted-foreground">{rec.city}</div>}
                                                    </td>
                                                    <td className="p-2.5 whitespace-nowrap">
                                                        {rec.status === "sent" ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                                <Check className="h-3 w-3 mr-0.5" /> Sent
                                                            </Badge>
                                                        ) : (
                                                            <div>
                                                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
                                                                    <XCircle className="h-3 w-3 mr-0.5" /> Failed
                                                                </Badge>
                                                                {rec.retries && rec.retries > 0 && (
                                                                    <span className="text-[9px] text-muted-foreground ml-1">({rec.retries} retries)</span>
                                                                )}
                                                                {rec.error && <p className="text-[9px] text-red-500 mt-0.5 max-w-[140px] truncate">{rec.error}</p>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                                        {rec.sessionUsed || "—"}
                                                    </td>
                                                    <td className="p-2.5 text-muted-foreground line-clamp-2 max-w-[240px]">
                                                        {rec.interpolatedMessage || "—"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-between items-center sm:justify-between border-t pt-3">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => selectedCampaignDetail && handleDeleteCampaign(selectedCampaignDetail.broadcastId)}
                            className="rounded-xl h-8 text-xs gap-1"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>

                        <div className="flex gap-2">
                            {selectedCampaignDetail && selectedCampaignDetail.status === "paused" && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setDetailModalOpen(false);
                                        handleResume(selectedCampaignDetail.broadcastId);
                                    }}
                                    className="rounded-xl h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 font-bold"
                                >
                                    <Play className="h-3.5 w-3.5" /> Resume Campaign
                                </Button>
                            )}
                            {selectedCampaignDetail && selectedCampaignDetail.failed > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryFailed(selectedCampaignDetail)}
                                    className="rounded-xl h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Retry {selectedCampaignDetail.failed} Failed
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={() => selectedCampaignDetail && handleRerunCampaign(selectedCampaignDetail)}
                                className="rounded-xl h-8 text-xs gap-1"
                            >
                                <Copy className="h-3.5 w-3.5" /> Clone
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: CRM LEADS PICKER                                              */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <Dialog open={crmModalOpen} onOpenChange={setCrmModalOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-3xl">
                    <DialogHeader className="pb-2 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-primary" /> Select CRM Leads for Campaign
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Choose leads directly from your CRM. Their names, phone numbers, and cities will be automatically injected.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3 flex-1 overflow-y-auto">
                        {/* Search & Stage Filter */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search by lead name, phone, city, category..."
                                    value={crmSearch}
                                    onChange={(e) => setCrmSearch(e.target.value)}
                                    className="pl-8 h-9 text-xs rounded-xl"
                                />
                            </div>

                            <select
                                className="h-9 text-xs bg-background border rounded-xl px-2.5 text-foreground"
                                value={crmStageFilter}
                                onChange={(e) => setCrmStageFilter(e.target.value)}
                            >
                                <option value="ALL">All Stages</option>
                                <option value="NEW">New Leads</option>
                                <option value="CONTACTED">Contacted</option>
                                <option value="INTERESTED">Interested</option>
                                <option value="QUALIFIED">Qualified</option>
                                <option value="PROPOSAL">Proposal</option>
                                <option value="WON">Won</option>
                            </select>
                        </div>

                        {/* Selection summary & quick toggle */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>
                                Showing <strong className="text-foreground">{filteredCrmLeads.length}</strong> leads
                                {crmSelectedLeadIds.length > 0 && (
                                    <> • Selected <strong className="text-primary">{crmSelectedLeadIds.length}</strong></>
                                )}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCrmSelectedLeadIds(filteredCrmLeads.map((l) => l.id))}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    Select All Filtered
                                </button>
                                <span>•</span>
                                <button
                                    type="button"
                                    onClick={() => setCrmSelectedLeadIds([])}
                                    className="text-xs text-muted-foreground hover:underline"
                                >
                                    Deselect All
                                </button>
                            </div>
                        </div>

                        {/* Leads List */}
                        {loadingCrm ? (
                            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2 opacity-50" />
                                <p className="text-xs">Loading CRM leads...</p>
                            </div>
                        ) : filteredCrmLeads.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-semibold">No leads found</p>
                                <p className="text-xs">Try adjusting your search query or stage filter.</p>
                            </div>
                        ) : (
                            <div className="border rounded-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-border/40">
                                {filteredCrmLeads.map((l) => {
                                    const isSelected = crmSelectedLeadIds.includes(l.id);
                                    return (
                                        <div
                                            key={l.id}
                                            onClick={() => {
                                                setCrmSelectedLeadIds((prev) =>
                                                    prev.includes(l.id) ? prev.filter((id) => id !== l.id) : [...prev, l.id]
                                                );
                                            }}
                                            className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                                isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                                            }`}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => {}}
                                                className="shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm truncate">{l.name}</span>
                                                    <Badge variant="outline" className="text-[10px] font-normal">{l.stage}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <span className="font-mono">{l.formattedPhone}</span>
                                                    {l.city && <span>• {l.city}</span>}
                                                    {l.category && <span>• {l.category}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t pt-3 flex justify-between sm:justify-between items-center">
                        <Button variant="ghost" size="sm" onClick={() => setCrmModalOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyCrmLeads}
                            className="rounded-xl font-bold gap-1.5 shadow-xs"
                            disabled={filteredCrmLeads.length === 0}
                        >
                            <Check className="h-4 w-4" /> Use {crmSelectedLeadIds.length > 0 ? crmSelectedLeadIds.length : filteredCrmLeads.length} Leads
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
