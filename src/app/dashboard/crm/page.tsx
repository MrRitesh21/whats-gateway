"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Users,
    Upload,
    Download,
    Plus,
    Search,
    RefreshCw,
    Trash2,
    MessageSquare,
    ExternalLink,
    Star,
    MapPin,
    Building2,
    CheckCircle2,
    Clock,
    Send,
    Filter,
    Layers,
    Phone,
    Globe,
    FileSpreadsheet,
    Zap,
    Kanban,
    List,
    MoreHorizontal,
    ArrowRight,
    Tag,
    Flame,
    Sun,
    Snowflake,
    Calendar,
    IndianRupee,
    Smartphone,
    Bell,
    FileText,
    Check,
    Sparkles,
    History,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/dashboard/session-provider";
import type { Lead, LeadStage, LeadPriority, LeadActivity, WhatsAppSyncResult } from "@/lib/crm/types";

const STAGES: { id: LeadStage; name: string; color: string; bg: string }[] = [
    { id: "NEW", name: "New Leads", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40" },
    { id: "CONTACTED", name: "Contacted", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" },
    { id: "INTERESTED", name: "Interested", color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/40" },
    { id: "QUALIFIED", name: "Qualified", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" },
    { id: "PROPOSAL", name: "Proposal Sent", color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800/40" },
    { id: "WON", name: "Won / Deals", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" },
    { id: "LOST", name: "Lost / Closed", color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800/40" },
];

const PRIORITY_CONFIG: Record<LeadPriority, { label: string; icon: any; color: string; bg: string; dot: string }> = {
    HOT: {
        label: "HOT",
        icon: Flame,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40",
        dot: "bg-rose-500",
    },
    WARM: {
        label: "WARM",
        icon: Sun,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40",
        dot: "bg-amber-500",
    },
    COLD: {
        label: "COLD",
        icon: Snowflake,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40",
        dot: "bg-blue-500",
    },
};

const QUICK_TEMPLATES = [
    {
        title: "👋 Welcome & Intro",
        badge: "Intro",
        text: "Hello {{name}}, thank you for connecting with us! We noticed your business under {{category}} in {{city}}. How can we assist you today?",
    },
    {
        title: "💼 B2B Proposal",
        badge: "Pitch",
        text: "Hi {{name}}, we specialize in WhatsApp automation & CRM growth for {{category}} companies in {{city}}. Can we share a quick 2-minute overview with you?",
    },
    {
        title: "🔔 Follow-Up",
        badge: "Follow-up",
        text: "Hello {{name}}, just following up on our previous conversation regarding {{category}} solutions. Have you had a moment to review the details?",
    },
    {
        title: "🔥 Special Deal Offer",
        badge: "Offer",
        text: "Hi {{name}}, we have a special limited-time enterprise package for businesses in {{city}} valued at {{value}}. Would you like to review the pricing sheet?",
    },
    {
        title: "🤝 Closing / Onboarding",
        badge: "Close",
        text: "Hello {{name}}, we are excited to work with you! Can we confirm the next onboarding steps today so we can get your pipeline running?",
    },
];

export default function CRMPage() {
    const router = useRouter();
    const { sessions, sessionId: activeSessionId } = useSession();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
    const [categories, setCategories] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [metrics, setMetrics] = useState({
        totalPipelineValue: 0,
        wonValue: 0,
        stageValues: {} as Record<string, number>,
        followUpsTodayCount: 0,
    });

    // Filters & Search
    const [search, setSearch] = useState("");
    const [selectedStage, setSelectedStage] = useState<string>("ALL");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [selectedCity, setSelectedCity] = useState<string>("ALL");
    const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
    const [onlyFollowUpsToday, setOnlyFollowUpsToday] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<string>("25"); // "10" | "25" | "50" | "100" | "all"

    // Selected Rows for Bulk Actions
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

    // CSV Upload Modal
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [csvText, setCsvText] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadStats, setUploadStats] = useState<any>(null);

    // WhatsApp Contacts Sync Modal
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [selectedSyncSession, setSelectedSyncSession] = useState<string>("");
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<WhatsAppSyncResult | null>(null);

    // Single Lead Create/Edit Modal
    const [leadModalOpen, setLeadModalOpen] = useState(false);
    const [leadForm, setLeadForm] = useState<Partial<Lead>>({
        name: "",
        phone: "",
        category: "General",
        city: "",
        state: "",
        address: "",
        website: "",
        rating: 5,
        stage: "NEW",
        priority: "WARM",
        value: 0,
        followUpDate: "",
        followUpNote: "",
        notes: "",
    });

    // Lead Detail Modal
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [activeLead, setActiveLead] = useState<Lead | null>(null);
    const [newNoteText, setNewNoteText] = useState("");
    const [addingNote, setAddingNote] = useState(false);

    // Quick Message Modal
    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [sendingMsg, setSendingMsg] = useState(false);
    const [targetLead, setTargetLead] = useState<Lead | null>(null);

    // Auto-select session for sync
    useEffect(() => {
        if (!selectedSyncSession && sessions && sessions.length > 0) {
            setSelectedSyncSession(activeSessionId || sessions[0].sessionId);
        }
    }, [sessions, activeSessionId, selectedSyncSession]);

    // Fetch leads from API
    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                search: search.trim(),
                stage: selectedStage,
                category: selectedCategory,
                city: selectedCity,
                priority: selectedPriority,
                limit: "all",
            });
            if (onlyFollowUpsToday) {
                params.set("onlyFollowUpsToday", "true");
            }

            const res = await fetch(`/api/crm/leads?${params}`);
            const json = await res.json();
            if (json.status) {
                setLeads(json.data.leads || []);
                setStageCounts(json.data.stageCounts || {});
                setCategories(json.data.categories || []);
                setCities(json.data.cities || []);
                if (json.data.metrics) {
                    setMetrics(json.data.metrics);
                }
            }
        } catch {
            toast.error("Failed to load CRM leads");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLeads();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, selectedStage, selectedCategory, selectedCity, selectedPriority, onlyFollowUpsToday]);

    // Reset current page whenever filters or search query change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, selectedStage, selectedCategory, selectedCity, selectedPriority, onlyFollowUpsToday]);

    // Pagination calculations
    const isAll = pageSize === "all";
    const numericPageSize = isAll ? Math.max(1, leads.length) : parseInt(pageSize, 10);
    const totalPages = isAll ? 1 : Math.max(1, Math.ceil(leads.length / numericPageSize));
    const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = isAll ? 0 : (validCurrentPage - 1) * numericPageSize;
    const endIndex = isAll ? leads.length : Math.min(startIndex + numericPageSize, leads.length);
    const displayedLeads = isAll ? leads : leads.slice(startIndex, endIndex);

    // Smart page numbers generator with ellipsis
    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (validCurrentPage <= 4) {
            return [1, 2, 3, 4, 5, "...", totalPages];
        }
        if (validCurrentPage >= totalPages - 3) {
            return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, "...", validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, "...", totalPages];
    }, [validCurrentPage, totalPages]);

    // Handle CSV File Selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadStats(null);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/crm/leads/upload-csv", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.status) {
                setUploadStats(data.data);
                toast.success(data.message);
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to parse CSV file");
            }
        } catch {
            toast.error("Network error uploading CSV");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Handle Raw CSV Text Upload
    const handleUploadRawCSV = async () => {
        if (!csvText.trim()) return toast.error("Please paste CSV text");
        setUploading(true);
        setUploadStats(null);
        try {
            const res = await fetch("/api/crm/leads/upload-csv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csvText }),
            });
            const data = await res.json();
            if (data.status) {
                setUploadStats(data.data);
                toast.success(data.message);
                setCsvText("");
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to import CSV");
            }
        } catch {
            toast.error("Failed to upload CSV");
        } finally {
            setUploading(false);
        }
    };

    // Handle WhatsApp Contacts Sync
    const handleSyncWhatsAppContacts = async () => {
        const sessId = selectedSyncSession || activeSessionId;
        if (!sessId) return toast.error("Please select a connected WhatsApp session");

        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/crm/leads/sync-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sessId }),
            });
            const data = await res.json();
            if (data.status) {
                setSyncResult(data.data);
                toast.success(data.message);
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to sync contacts");
            }
        } catch {
            toast.error("Network error syncing WhatsApp contacts");
        } finally {
            setSyncing(false);
        }
    };

    // Save or Update Lead
    const handleSaveLead = async () => {
        if (!leadForm.name?.trim() || !leadForm.phone?.trim()) {
            return toast.error("Name and Phone number are required");
        }
        try {
            const res = await fetch("/api/crm/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead: leadForm }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message);
                setLeadModalOpen(false);
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to save lead");
            }
        } catch {
            toast.error("Network error saving lead");
        }
    };

    // Quick Change Stage
    const handleChangeStage = async (leadId: string, newStage: LeadStage) => {
        try {
            const res = await fetch("/api/crm/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: leadId, stage: newStage }),
            });
            const data = await res.json();
            if (data.status) {
                setLeads((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
                );
                // Refresh stage counts
                setStageCounts((prev) => {
                    const currentLead = leads.find((l) => l.id === leadId);
                    if (!currentLead) return prev;
                    return {
                        ...prev,
                        [currentLead.stage]: Math.max(0, (prev[currentLead.stage] || 1) - 1),
                        [newStage]: (prev[newStage] || 0) + 1,
                    };
                });
                toast.success(`Moved to ${newStage}`);
            }
        } catch {
            toast.error("Failed to update stage");
        }
    };

    // Delete single lead
    const handleDeleteLead = async (id: string) => {
        if (!confirm("Are you sure you want to remove this lead?")) return;
        try {
            const res = await fetch(`/api/crm/leads?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.status) {
                toast.success("Lead removed");
                setLeads((prev) => prev.filter((l) => l.id !== id));
            }
        } catch {
            toast.error("Failed to delete lead");
        }
    };

    // Batch Move Stage
    const handleBatchMoveStage = async (targetStage: LeadStage) => {
        if (selectedLeadIds.length === 0) return;
        try {
            const res = await fetch("/api/crm/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedLeadIds, stage: targetStage }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message);
                setSelectedLeadIds([]);
                fetchLeads();
            }
        } catch {
            toast.error("Failed to batch update leads");
        }
    };

    // Batch Set Priority
    const handleBatchSetPriority = async (priority: LeadPriority) => {
        if (selectedLeadIds.length === 0) return;
        try {
            const res = await fetch("/api/crm/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedLeadIds, priority }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(`Marked ${selectedLeadIds.length} lead(s) as ${priority}`);
                setSelectedLeadIds([]);
                fetchLeads();
            }
        } catch {
            toast.error("Failed to update priority");
        }
    };

    // Batch Delete Leads
    const handleBatchDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedLeadIds.length} leads?`)) return;
        try {
            const res = await fetch("/api/crm/leads", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedLeadIds }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message);
                setSelectedLeadIds([]);
                fetchLeads();
            }
        } catch {
            toast.error("Failed to delete leads");
        }
    };

    // Push Selected to Bulk Messenger
    const handlePushToBulkMessenger = () => {
        const targetLeads = selectedLeadIds.length > 0
            ? leads.filter((l) => selectedLeadIds.includes(l.id))
            : leads;

        if (targetLeads.length === 0) return toast.error("No leads to send to Bulk Messenger");

        const phoneNumbers = targetLeads.map((l) => l.formattedPhone).join("\n");
        if (typeof window !== "undefined") {
            sessionStorage.setItem("bulk_prefill_contacts", phoneNumbers);
            sessionStorage.setItem("bulk_prefill_leads", JSON.stringify(targetLeads));
            router.push("/dashboard/bulk-messenger");
        }
    };

    // Send Direct WhatsApp Message via active session
    const handleSendQuickMessage = async () => {
        if (!targetLead || !messageText.trim()) return toast.error("Message cannot be empty");
        if (!activeSessionId) return toast.error("No WhatsApp session selected in dashboard");

        setSendingMsg(true);
        try {
            const res = await fetch(`/api/messages/${activeSessionId}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    receiver: targetLead.formattedPhone,
                    message: { text: messageText.trim() },
                }),
            });
            const data = await res.json();
            if (res.ok && data.status) {
                toast.success(`Message sent to ${targetLead.name}!`);

                // Log activity to lead timeline
                await fetch("/api/crm/leads", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: targetLead.id,
                        action: "add_activity",
                        activity: {
                            type: "message",
                            content: `WhatsApp sent: ${messageText.trim().slice(0, 120)}${messageText.length > 120 ? "..." : ""}`,
                        },
                    }),
                });

                setMessageModalOpen(false);
                setMessageText("");
                // Auto move to CONTACTED if it was in NEW
                if (targetLead.stage === "NEW") {
                    handleChangeStage(targetLead.id, "CONTACTED");
                }
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to send message");
            }
        } catch {
            toast.error("Network error sending WhatsApp message");
        } finally {
            setSendingMsg(false);
        }
    };

    // Add note in detail modal
    const handleAddNote = async () => {
        if (!activeLead || !newNoteText.trim()) return;
        setAddingNote(true);
        try {
            const res = await fetch("/api/crm/leads", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: activeLead.id,
                    action: "add_activity",
                    activity: {
                        type: "note",
                        content: newNoteText.trim(),
                    },
                }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success("Note added to timeline");
                const newAct: LeadActivity = {
                    id: `act_${Date.now()}`,
                    type: "note",
                    content: newNoteText.trim(),
                    createdAt: new Date().toISOString(),
                };
                setActiveLead({
                    ...activeLead,
                    activities: [newAct, ...(activeLead.activities || [])],
                });
                setNewNoteText("");
                fetchLeads();
            } else {
                toast.error(data.message || "Failed to save note");
            }
        } catch {
            toast.error("Error saving note");
        } finally {
            setAddingNote(false);
        }
    };

    // Quick trigger quick message modal
    const openQuickMessage = (lead: Lead) => {
        setTargetLead(lead);
        setMessageText(`Hello ${lead.name},\n\nWe noticed your business listing under ${lead.category || "your area"}. We would love to connect and share more about our services.`);
        setMessageModalOpen(true);
    };

    // Template applier
    const applyTemplate = (tmplText: string) => {
        if (!targetLead) return;
        const formatted = tmplText
            .replace(/{{name}}/g, targetLead.name || "Customer")
            .replace(/{{category}}/g, targetLead.category || "business")
            .replace(/{{city}}/g, targetLead.city || "your area")
            .replace(/{{phone}}/g, targetLead.formattedPhone || "")
            .replace(/{{value}}/g, targetLead.value ? `₹${targetLead.value.toLocaleString("en-IN")}` : "our solution");
        setMessageText(formatted);
    };

    const insertVariable = (variable: string) => {
        if (!targetLead) return;
        let value = "";
        if (variable === "{{name}}") value = targetLead.name || "Customer";
        if (variable === "{{category}}") value = targetLead.category || "business";
        if (variable === "{{city}}") value = targetLead.city || "your city";
        if (variable === "{{phone}}") value = targetLead.formattedPhone || "";
        if (variable === "{{value}}") value = targetLead.value ? `₹${targetLead.value.toLocaleString("en-IN")}` : "0";
        setMessageText((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + value);
    };

    // Summary calculations
    const totalLeads = leads.length;
    const wonCount = stageCounts["WON"] || 0;
    const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : "0.0";

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Header & Main Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                            <Users className="h-5 w-5" />
                        </div>
                        WhatsApp CRM &amp; Lead Pipeline
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage B2B leads, organize pipelines, track deal values, log timeline activities, and broadcast messages.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setUploadStats(null);
                            setUploadModalOpen(true);
                        }}
                        className="gap-1.5 h-9"
                    >
                        <Upload className="h-4 w-4 text-teal-600" /> Upload CSV
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            window.open("/api/crm/leads/export", "_blank");
                        }}
                        className="gap-1.5 h-9"
                    >
                        <Download className="h-4 w-4 text-blue-600" /> Export CSV
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setLeadForm({
                                name: "",
                                phone: "",
                                category: "General",
                                city: "",
                                state: "",
                                address: "",
                                website: "",
                                rating: 5,
                                stage: "NEW",
                                priority: "WARM",
                                value: 0,
                                followUpDate: "",
                                followUpNote: "",
                                notes: "",
                            });
                            setLeadModalOpen(true);
                        }}
                        className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <Plus className="h-4 w-4" /> Add Lead
                    </Button>
                </div>
            </div>

            {/* Metric & Revenue Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="border-border/60">
                    <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                            <Users className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-bold truncate">{totalLeads}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                Total Leads
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60">
                    <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                            <IndianRupee className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-bold text-emerald-600 truncate">
                                ₹{metrics.totalPipelineValue.toLocaleString("en-IN")}
                            </div>
                            <div className="text-xs text-muted-foreground">Pipeline Value</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60">
                    <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 shrink-0">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-bold text-cyan-600 truncate">
                                ₹{metrics.wonValue.toLocaleString("en-IN")}
                            </div>
                            <div className="text-xs text-muted-foreground">{wonCount} Deals Won</div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setOnlyFollowUpsToday(!onlyFollowUpsToday)}
                    className={`border-border/60 cursor-pointer transition-all hover:border-amber-500/50 ${
                        onlyFollowUpsToday ? "ring-2 ring-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10" : ""
                    }`}
                >
                    <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                            <Bell className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-bold flex items-center gap-1.5 truncate">
                                <span>{metrics.followUpsTodayCount}</span>
                                {metrics.followUpsTodayCount > 0 && (
                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                Follow-Ups Today
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60">
                    <CardContent className="p-3.5 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-bold truncate">{conversionRate}%</div>
                            <div className="text-xs text-muted-foreground">Conversion Rate</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters, Priority, Search & Bulk Actions Bar */}
            <Card className="border-border/60">
                <CardContent className="p-3.5 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, phone, city, notes, or deal value..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-10 text-xs"
                            />
                        </div>

                        {/* Dropdown Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Priority Filter */}
                            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                                <SelectTrigger className="w-[140px] h-10 text-xs">
                                    <SelectValue placeholder="All Priorities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Priorities</SelectItem>
                                    <SelectItem value="HOT">🔥 Hot Leads</SelectItem>
                                    <SelectItem value="WARM">☀️ Warm Leads</SelectItem>
                                    <SelectItem value="COLD">❄️ Cold Leads</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Category Filter */}
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-[150px] h-10 text-xs">
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Categories</SelectItem>
                                    {categories.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* City Filter */}
                            {cities.length > 0 && (
                                <Select value={selectedCity} onValueChange={setSelectedCity}>
                                    <SelectTrigger className="w-[130px] h-10 text-xs">
                                        <SelectValue placeholder="All Cities" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Cities</SelectItem>
                                        {cities.map((city) => (
                                            <SelectItem key={city} value={city}>
                                                {city}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* View Switcher */}
                            <div className="flex items-center rounded-lg border border-border/50 p-1 bg-muted/40">
                                <button
                                    onClick={() => setViewMode("table")}
                                    className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                                        viewMode === "table"
                                            ? "bg-background shadow-xs text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <List className="h-3.5 w-3.5" /> Table
                                </button>
                                <button
                                    onClick={() => setViewMode("kanban")}
                                    className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                                        viewMode === "kanban"
                                            ? "bg-background shadow-xs text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Kanban className="h-3.5 w-3.5" /> Pipeline
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stage & Follow-Up Quick Filter Pills */}
                    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setSelectedStage("ALL")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    selectedStage === "ALL"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                All ({totalLeads})
                            </button>
                            {STAGES.map((st) => (
                                <button
                                    key={st.id}
                                    onClick={() => setSelectedStage(st.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                                        selectedStage === st.id
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                                >
                                    <span className={st.color}>●</span>
                                    {st.name} ({stageCounts[st.id] || 0})
                                </button>
                            ))}
                        </div>

                        {/* Today's follow-up toggle pill */}
                        <button
                            onClick={() => setOnlyFollowUpsToday(!onlyFollowUpsToday)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 border transition-all shrink-0 ${
                                onlyFollowUpsToday
                                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                    : "bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40 hover:bg-amber-100/50"
                            }`}
                        >
                            <Bell className="h-3.5 w-3.5" />
                            <span>Today's Follow-Ups</span>
                            {metrics.followUpsTodayCount > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${onlyFollowUpsToday ? "bg-white text-amber-600 font-bold" : "bg-amber-500 text-white font-bold"}`}>
                                    {metrics.followUpsTodayCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Batch Actions Bar (Visible when leads selected) */}
                    {selectedLeadIds.length > 0 && (
                        <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800/40 text-xs">
                            <span className="font-semibold text-blue-950 dark:text-blue-200">
                                {selectedLeadIds.length} lead(s) selected
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Batch Stage Move */}
                                <Select onValueChange={(val: any) => handleBatchMoveStage(val)}>
                                    <SelectTrigger className="h-8 text-xs w-[130px] bg-background">
                                        <SelectValue placeholder="Move Stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STAGES.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Batch Priority Change */}
                                <Select onValueChange={(val: any) => handleBatchSetPriority(val)}>
                                    <SelectTrigger className="h-8 text-xs w-[130px] bg-background">
                                        <SelectValue placeholder="Set Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="HOT">🔥 Mark Hot</SelectItem>
                                        <SelectItem value="WARM">☀️ Mark Warm</SelectItem>
                                        <SelectItem value="COLD">❄️ Mark Cold</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePushToBulkMessenger}
                                    className="h-8 text-xs gap-1 bg-background"
                                >
                                    <Zap className="h-3.5 w-3.5 text-primary" /> Send to Bulk Messenger
                                </Button>

                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleBatchDelete}
                                    className="h-8 text-xs gap-1"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ─── VIEW 1: TABLE VIEW ─────────────────────────────────────────────────── */}
            {viewMode === "table" && (
                <Card className="border-border/60">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2 opacity-60" />
                                <p className="text-xs">Loading pipeline leads...</p>
                            </div>
                        ) : leads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                <Building2 className="h-10 w-10 mb-2 opacity-30" />
                                <p className="text-sm font-semibold">No leads found</p>
                                <p className="text-xs mt-1">Upload a CSV file or add a lead to get started.</p>
                                <div className="flex items-center gap-2 mt-4">
                                    <Button
                                        size="sm"
                                        onClick={() => setUploadModalOpen(true)}
                                        className="gap-1.5"
                                    >
                                        <Upload className="h-3.5 w-3.5" /> Upload CSV
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="text-xs hover:bg-transparent">
                                            <TableHead className="w-10">
                                                <Checkbox
                                                    checked={
                                                        displayedLeads.length > 0 &&
                                                        displayedLeads.every((l) => selectedLeadIds.includes(l.id))
                                                    }
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedLeadIds((prev) => {
                                                                const set = new Set(prev);
                                                                displayedLeads.forEach((l) => set.add(l.id));
                                                                return Array.from(set);
                                                            });
                                                        } else {
                                                            const displayedIds = new Set(displayedLeads.map((l) => l.id));
                                                            setSelectedLeadIds((prev) => prev.filter((id) => !displayedIds.has(id)));
                                                        }
                                                    }}
                                                />
                                            </TableHead>
                                            <TableHead>Business / Contact</TableHead>
                                            <TableHead>Priority</TableHead>
                                            <TableHead>WhatsApp Phone</TableHead>
                                            <TableHead>Deal Value</TableHead>
                                            <TableHead>Category / City</TableHead>
                                            <TableHead>Follow-Up</TableHead>
                                            <TableHead>Pipeline Stage</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedLeads.map((lead) => {
                                            const isSelected = selectedLeadIds.includes(lead.id);
                                            const stageObj = STAGES.find((s) => s.id === lead.stage) || STAGES[0];
                                            const priorityObj = lead.priority ? PRIORITY_CONFIG[lead.priority] : PRIORITY_CONFIG.WARM;
                                            const PriorityIcon = priorityObj.icon;

                                            return (
                                                <TableRow key={lead.id} className={`text-xs ${isSelected ? "bg-primary/5" : ""}`}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setSelectedLeadIds((prev) => [...prev, lead.id]);
                                                                else setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div
                                                            onClick={() => {
                                                                setActiveLead(lead);
                                                                setDetailModalOpen(true);
                                                            }}
                                                            className="cursor-pointer group"
                                                        >
                                                            <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                                {lead.name}
                                                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                            {lead.keyword && (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    via {lead.keyword}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`text-[10px] gap-1 px-1.5 py-0.5 ${priorityObj.bg}`}>
                                                            <PriorityIcon className="h-3 w-3" />
                                                            <span>{priorityObj.label}</span>
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-mono text-[11px] flex items-center gap-1.5">
                                                            <span className="text-foreground">{lead.formattedPhone}</span>
                                                            <button
                                                                onClick={() => openQuickMessage(lead)}
                                                                title="Send WhatsApp Message"
                                                                className="h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                            >
                                                                <MessageSquare className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-semibold text-foreground font-mono">
                                                            ₹{(lead.value || 0).toLocaleString("en-IN")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-0.5">
                                                            <Badge variant="outline" className="text-[9px] font-normal">
                                                                {lead.category || "General"}
                                                            </Badge>
                                                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                                                {lead.city || "—"}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {lead.followUpDate ? (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                                                <Calendar className="h-3 w-3" />
                                                                <span>{lead.followUpDate}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-[10px]">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={lead.stage}
                                                            onValueChange={(val: any) => handleChangeStage(lead.id, val)}
                                                        >
                                                            <SelectTrigger className="h-7 text-[10px] w-[130px] rounded-lg">
                                                                <SelectValue placeholder="Select Stage">
                                                                    <div className="flex items-center gap-1.5 truncate">
                                                                        <span className={stageObj.color}>●</span>
                                                                        <span>{stageObj.name}</span>
                                                                    </div>
                                                                </SelectValue>
                                                            </SelectTrigger>
                                                            <SelectContent position="popper" align="end" className="z-50">
                                                                {STAGES.map((s) => (
                                                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={s.color}>●</span>
                                                                            {s.name}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openQuickMessage(lead)}
                                                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteLead(lead.id)}
                                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* ─── TABLE PAGINATION FOOTER ─────────────────────────────────────────── */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 border-t border-border/50 bg-muted/15 text-xs">
                                {/* Left: Items Count & Selection Status */}
                                <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                                    <div>
                                        {leads.length === 0 ? (
                                            <span>0 leads</span>
                                        ) : isAll ? (
                                            <span>
                                                Showing all <strong className="text-foreground font-semibold">{leads.length}</strong> leads
                                            </span>
                                        ) : (
                                            <span>
                                                Showing <strong className="text-foreground font-semibold">{startIndex + 1}</strong> to{" "}
                                                <strong className="text-foreground font-semibold">{endIndex}</strong> of{" "}
                                                <strong className="text-foreground font-semibold">{leads.length}</strong> leads
                                            </span>
                                        )}
                                    </div>

                                    {selectedLeadIds.length > 0 && (
                                        <div className="flex items-center gap-2 border-l border-border/60 pl-3">
                                            <Badge variant="secondary" className="text-[11px] font-normal py-0">
                                                {selectedLeadIds.length} selected
                                            </Badge>
                                            {selectedLeadIds.length < leads.length && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLeadIds(leads.map((l) => l.id))}
                                                    className="text-primary hover:underline text-[11px] font-medium"
                                                >
                                                    Select all {leads.length}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLeadIds([])}
                                                className="text-muted-foreground hover:text-foreground text-[11px]"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Rows Per Page & Page Navigation */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    {/* Rows Per Page Selector */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground whitespace-nowrap">Rows per page:</span>
                                        <Select
                                            value={pageSize}
                                            onValueChange={(val) => {
                                                setPageSize(val);
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-[78px] text-xs font-medium bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent align="end">
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                                <SelectItem value="all">All</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Navigation controls */}
                                    {!isAll && totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 bg-background"
                                                disabled={validCurrentPage <= 1}
                                                onClick={() => setCurrentPage(1)}
                                                title="First page"
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 bg-background"
                                                disabled={validCurrentPage <= 1}
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                title="Previous page"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>

                                            <div className="flex items-center gap-1 mx-1">
                                                {pageNumbers.map((p, idx) => {
                                                    if (typeof p === "string") {
                                                        return (
                                                            <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground font-semibold">
                                                                …
                                                            </span>
                                                        );
                                                    }
                                                    const isCurrent = p === validCurrentPage;
                                                    return (
                                                        <Button
                                                            key={`page-${p}`}
                                                            variant={isCurrent ? "default" : "outline"}
                                                            size="sm"
                                                            className={`h-8 min-w-[32px] px-2 text-xs font-medium ${
                                                                isCurrent ? "shadow-sm pointer-events-none" : "bg-background"
                                                            }`}
                                                            onClick={() => setCurrentPage(p)}
                                                        >
                                                            {p}
                                                        </Button>
                                                    );
                                                })}
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 bg-background"
                                                disabled={validCurrentPage >= totalPages}
                                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                title="Next page"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 w-8 p-0 bg-background"
                                                disabled={validCurrentPage >= totalPages}
                                                onClick={() => setCurrentPage(totalPages)}
                                                title="Last page"
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── VIEW 2: KANBAN PIPELINE BOARD ───────────────────────────────────────── */}
            {viewMode === "kanban" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 overflow-x-auto pb-4">
                    {STAGES.map((st) => {
                        const stageLeads = leads.filter((l) => l.stage === st.id);
                        const stageTotalValue = stageLeads.reduce((acc, curr) => acc + (curr.value || 0), 0);

                        return (
                            <div key={st.id} className="flex flex-col bg-muted/30 rounded-2xl border border-border/50 min-w-[260px]">
                                {/* Column Header */}
                                <div className="p-3 border-b border-border/40">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                                            <span className={st.color}>●</span>
                                            <span>{st.name}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5">
                                            {stageLeads.length}
                                        </Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between font-mono">
                                        <span>Total:</span>
                                        <span className="font-semibold text-foreground">₹{stageTotalValue.toLocaleString("en-IN")}</span>
                                    </div>
                                </div>

                                {/* Cards list */}
                                <div className="p-2 space-y-2 flex-1 max-h-[700px] overflow-y-auto styled-scrollbar">
                                    {stageLeads.length === 0 ? (
                                        <div className="py-8 text-center text-[11px] text-muted-foreground/60 border border-dashed rounded-xl border-border/40">
                                            No leads
                                        </div>
                                    ) : (
                                        stageLeads.map((lead) => {
                                            const priorityObj = lead.priority ? PRIORITY_CONFIG[lead.priority] : PRIORITY_CONFIG.WARM;
                                            const PriorityIcon = priorityObj.icon;

                                            return (
                                                <Card
                                                    key={lead.id}
                                                    className="border-border/50 hover:border-primary/50 transition-all shadow-xs cursor-pointer bg-background"
                                                    onClick={() => {
                                                        setActiveLead(lead);
                                                        setDetailModalOpen(true);
                                                    }}
                                                >
                                                    <CardContent className="p-3 space-y-2">
                                                        <div className="flex items-start justify-between gap-1.5">
                                                            <h4 className="font-semibold text-xs line-clamp-2 leading-tight">
                                                                {lead.name}
                                                            </h4>
                                                            <Badge variant="outline" className={`text-[9px] px-1 py-0 gap-0.5 shrink-0 ${priorityObj.bg}`}>
                                                                <PriorityIcon className="h-2.5 w-2.5" />
                                                                {priorityObj.label}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-semibold font-mono text-emerald-600 text-xs">
                                                                ₹{(lead.value || 0).toLocaleString("en-IN")}
                                                            </span>
                                                            <Badge variant="outline" className="text-[9px] px-1 font-normal truncate max-w-[110px]">
                                                                {lead.category || "General"}
                                                            </Badge>
                                                        </div>

                                                        {lead.followUpDate && (
                                                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50/50 dark:bg-amber-950/20 p-1 rounded border border-amber-200/40">
                                                                <Clock className="h-3 w-3 shrink-0" />
                                                                <span className="truncate">{lead.followUpDate}</span>
                                                            </div>
                                                        )}

                                                        <div className="font-mono text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/30">
                                                            <span>{lead.formattedPhone}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openQuickMessage(lead);
                                                                }}
                                                                className="h-5 w-5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center hover:bg-emerald-100"
                                                            >
                                                                <MessageSquare className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── MODAL: SYNC FROM WHATSAPP CONTACTS ──────────────────────────────────── */}
            <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-emerald-600" /> Sync WhatsApp Contacts
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Import existing WhatsApp chats and address book contacts directly into your CRM pipeline without manual CSV export.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Select Connected WhatsApp Session</Label>
                            <Select
                                value={selectedSyncSession}
                                onValueChange={setSelectedSyncSession}
                            >
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Choose WhatsApp session" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sessions && sessions.length > 0 ? (
                                        sessions.map((s) => (
                                            <SelectItem key={s.sessionId} value={s.sessionId} className="text-xs">
                                                {s.sessionId} ({s.status || "active"})
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>
                                            No active WhatsApp sessions
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {syncResult && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-2">
                                <div className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> WhatsApp Contacts Synced!
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                    <div className="p-1.5 bg-background/60 rounded border border-border/40">
                                        <div className="font-bold text-emerald-600 text-sm">{syncResult.imported}</div>
                                        <div className="text-[10px] text-muted-foreground">New Leads</div>
                                    </div>
                                    <div className="p-1.5 bg-background/60 rounded border border-border/40">
                                        <div className="font-bold text-amber-600 text-sm">{syncResult.skippedDuplicates}</div>
                                        <div className="text-[10px] text-muted-foreground">Existing</div>
                                    </div>
                                    <div className="p-1.5 bg-background/60 rounded border border-border/40">
                                        <div className="font-bold text-foreground text-sm">{syncResult.totalContacts}</div>
                                        <div className="text-[10px] text-muted-foreground">Total In Phone</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSyncModalOpen(false)}>
                            Close
                        </Button>
                        <Button
                            size="sm"
                            disabled={syncing || !selectedSyncSession}
                            onClick={handleSyncWhatsAppContacts}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                            {syncing ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Syncing Contacts...
                                </>
                            ) : (
                                <>
                                    <Smartphone className="h-3.5 w-3.5" /> Start 1-Click Sync
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL: UPLOAD CSV ───────────────────────────────────────────────────── */}
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
                <DialogContent className="sm:max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Upload className="h-4 w-4 text-emerald-600" /> Upload Leads via CSV
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Upload a Google Maps B2B scraper export or any CSV file containing business names and phone numbers.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Drag & Drop File Zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border/70 hover:border-emerald-500/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-muted/20"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <FileSpreadsheet className="h-10 w-10 mx-auto text-emerald-600 mb-2 opacity-80" />
                            <p className="text-sm font-semibold">Click to select CSV File</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Automatically detects columns: Name, Phone, Category, City, Address, Rating, Website.
                            </p>
                        </div>

                        {/* Or Paste CSV Text */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Or Paste Raw CSV Data Directly</Label>
                            <Textarea
                                rows={6}
                                value={csvText}
                                onChange={(e) => setCsvText(e.target.value)}
                                placeholder="Keyword,Name,Phone,City,Category..."
                                className="text-xs font-mono"
                            />
                        </div>

                        {/* Import Result Stats */}
                        {uploadStats && (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1">
                                <div className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Import Summary
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                                    <div className="p-1 bg-background/60 rounded">
                                        <div className="font-bold text-emerald-600">{uploadStats.imported}</div>
                                        <div className="text-[10px] text-muted-foreground">Imported</div>
                                    </div>
                                    <div className="p-1 bg-background/60 rounded">
                                        <div className="font-bold text-amber-600">{uploadStats.skippedDuplicates}</div>
                                        <div className="text-[10px] text-muted-foreground">Duplicates</div>
                                    </div>
                                    <div className="p-1 bg-background/60 rounded">
                                        <div className="font-bold text-muted-foreground">{uploadStats.invalidPhone}</div>
                                        <div className="text-[10px] text-muted-foreground">Invalid Phone</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setUploadModalOpen(false)}>
                            Close
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleUploadRawCSV}
                            disabled={uploading || !csvText.trim()}
                        >
                            {uploading ? (
                                <>
                                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Processing...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-3.5 w-3.5" /> Parse &amp; Import
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL: ADD / EDIT SINGLE LEAD ───────────────────────────────────────── */}
            <Dialog open={leadModalOpen} onOpenChange={setLeadModalOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" /> Add New Lead
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="space-y-1">
                            <Label className="text-xs">Business / Contact Name *</Label>
                            <Input
                                value={leadForm.name || ""}
                                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                                placeholder="e.g. Apex Dental Clinic"
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Phone Number *</Label>
                                <Input
                                    value={leadForm.phone || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                                    placeholder="09935370814 or 919935370814"
                                    className="h-9 text-xs font-mono"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Category</Label>
                                <Input
                                    value={leadForm.category || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, category: e.target.value })}
                                    placeholder="Dental clinic, Doctor, Retail"
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Pipeline Stage</Label>
                                <Select
                                    value={leadForm.stage || "NEW"}
                                    onValueChange={(val: any) => setLeadForm({ ...leadForm, stage: val })}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STAGES.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Priority</Label>
                                <Select
                                    value={leadForm.priority || "WARM"}
                                    onValueChange={(val: any) => setLeadForm({ ...leadForm, priority: val })}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="HOT">🔥 Hot</SelectItem>
                                        <SelectItem value="WARM">☀️ Warm</SelectItem>
                                        <SelectItem value="COLD">❄️ Cold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Deal Value (₹)</Label>
                                <Input
                                    type="number"
                                    value={leadForm.value ?? 0}
                                    onChange={(e) => setLeadForm({ ...leadForm, value: parseFloat(e.target.value) || 0 })}
                                    placeholder="25000"
                                    className="h-9 text-xs font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Follow-Up Date</Label>
                                <Input
                                    type="date"
                                    value={leadForm.followUpDate || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, followUpDate: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Follow-Up Reminder Note</Label>
                                <Input
                                    value={leadForm.followUpNote || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, followUpNote: e.target.value })}
                                    placeholder="Call back after demo"
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">City</Label>
                                <Input
                                    value={leadForm.city || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                                    placeholder="Lucknow"
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Website</Label>
                                <Input
                                    value={leadForm.website || ""}
                                    onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })}
                                    placeholder="https://..."
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Address</Label>
                            <Input
                                value={leadForm.address || ""}
                                onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                                placeholder="Street, Sector, City"
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Initial Notes / Requirements</Label>
                            <Textarea
                                rows={2}
                                value={leadForm.notes || ""}
                                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                                placeholder="Lead requirements or background info..."
                                className="text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setLeadModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveLead} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Save Lead
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL: LEAD DETAIL & TIMELINE VIEW ────────────────────────────────────── */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center justify-between">
                            <span className="truncate pr-2">{activeLead?.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {activeLead?.priority && (
                                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_CONFIG[activeLead.priority].bg}`}>
                                        {activeLead.priority}
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                    {activeLead?.stage}
                                </Badge>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {activeLead && (
                        <div className="space-y-4 py-2 text-xs">
                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-3 gap-2.5 p-3 bg-muted/40 rounded-xl border border-border/40">
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">WhatsApp</span>
                                    <span className="font-mono font-semibold">{activeLead.formattedPhone}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">Deal Value</span>
                                    <span className="font-semibold text-emerald-600 font-mono">
                                        ₹{(activeLead.value || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">Category</span>
                                    <span className="font-semibold">{activeLead.category}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">Rating</span>
                                    <span className="font-semibold text-amber-600 flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                        {activeLead.rating || "—"} ({activeLead.reviewsCount || 0})
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">Location</span>
                                    <span className="font-semibold">{activeLead.city || "—"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px]">Follow-Up Date</span>
                                    <span className="font-semibold text-amber-600">{activeLead.followUpDate || "None"}</span>
                                </div>
                            </div>

                            {activeLead.followUpNote && (
                                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/40 text-[11px] flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-amber-600 shrink-0" />
                                    <span>Follow-up: <strong>{activeLead.followUpNote}</strong></span>
                                </div>
                            )}

                            {activeLead.address && (
                                <div className="space-y-1">
                                    <span className="text-muted-foreground block text-[10px]">Full Address</span>
                                    <p className="p-2 bg-muted/20 rounded-lg border border-border/30">
                                        {activeLead.address}
                                    </p>
                                </div>
                            )}

                            {activeLead.website && (
                                <div className="space-y-1">
                                    <span className="text-muted-foreground block text-[10px]">Website</span>
                                    <a
                                        href={activeLead.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Globe className="h-3 w-3" /> {activeLead.website}
                                    </a>
                                </div>
                            )}

                            {/* Quick Stage Mover */}
                            <div className="space-y-1.5 pt-2 border-t border-border/30">
                                <Label className="text-xs">Update Pipeline Stage</Label>
                                <Select
                                    value={activeLead.stage}
                                    onValueChange={(val: any) => {
                                        handleChangeStage(activeLead.id, val);
                                        setActiveLead({ ...activeLead, stage: val });
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STAGES.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Activity & Notes Timeline */}
                            <div className="space-y-3 pt-3 border-t border-border/30">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold flex items-center gap-1.5 text-xs">
                                        <History className="h-3.5 w-3.5 text-primary" /> Activity &amp; Notes Timeline
                                    </span>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {activeLead.activities?.length || 0} event(s)
                                    </Badge>
                                </div>

                                {/* Log Note Form */}
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a call summary, client feedback, or reminder..."
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddNote();
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    <Button
                                        size="sm"
                                        disabled={addingNote || !newNoteText.trim()}
                                        onClick={handleAddNote}
                                        className="h-8 text-xs shrink-0"
                                    >
                                        Save Note
                                    </Button>
                                </div>

                                {/* Timeline items */}
                                <div className="space-y-2 max-h-[220px] overflow-y-auto styled-scrollbar pr-1">
                                    {(!activeLead.activities || activeLead.activities.length === 0) ? (
                                        <p className="text-muted-foreground text-[11px] text-center py-4 border border-dashed rounded-lg">
                                            No logged activities yet. Add your first note above.
                                        </p>
                                    ) : (
                                        activeLead.activities.map((act) => (
                                            <div
                                                key={act.id}
                                                className="p-2 bg-muted/30 rounded-lg border border-border/40 text-[11px] space-y-0.5"
                                            >
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                    <span className="font-semibold text-foreground flex items-center gap-1">
                                                        {act.type === "message" ? (
                                                            <MessageSquare className="h-3 w-3 text-emerald-600" />
                                                        ) : act.type === "stage_change" ? (
                                                            <Layers className="h-3 w-3 text-blue-600" />
                                                        ) : act.type === "followup" ? (
                                                            <Clock className="h-3 w-3 text-purple-600" />
                                                        ) : (
                                                            <FileText className="h-3 w-3 text-amber-600" />
                                                        )}
                                                        {act.type === "message"
                                                            ? "WhatsApp Message"
                                                            : act.type === "stage_change"
                                                            ? "Pipeline Stage"
                                                            : act.type === "followup"
                                                            ? "Follow-Up Reminder"
                                                            : "Note"}
                                                    </span>
                                                    <span>{new Date(act.createdAt).toLocaleString()}</span>
                                                </div>
                                                {act.content && (
                                                    <p className="text-foreground/90 pl-4">{act.content}</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                                setDetailModalOpen(false);
                                if (activeLead) openQuickMessage(activeLead);
                            }}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <MessageSquare className="h-3.5 w-3.5" /> Send WhatsApp Message
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL: DIRECT WHATSAPP MESSAGE & 1-CLICK TEMPLATES ────────────────── */}
            <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Send className="h-4 w-4 text-emerald-600" /> Send WhatsApp to {targetLead?.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Sends direct WhatsApp message via connected session:{" "}
                            <span className="font-mono text-primary font-semibold">{activeSessionId || "(No Session Selected)"}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="p-2.5 bg-muted/40 rounded-xl text-xs font-mono flex items-center justify-between">
                            <span>Recipient: <strong className="text-foreground">{targetLead?.formattedPhone}</strong></span>
                            {targetLead?.category && (
                                <Badge variant="outline" className="text-[10px]">{targetLead.category}</Badge>
                            )}
                        </div>

                        {/* 1-Click Message Templates */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="font-semibold flex items-center gap-1 text-foreground">
                                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> 1-Click Quick Templates
                                </span>
                                <span>Click to load</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {QUICK_TEMPLATES.map((tmpl, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => applyTemplate(tmpl.text)}
                                        className="px-2 py-1 bg-muted/60 hover:bg-muted rounded-md text-[10px] font-medium border border-border/50 transition-colors"
                                    >
                                        {tmpl.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Variable insertion chips */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>Variables:</span>
                            {["{{name}}", "{{category}}", "{{city}}", "{{value}}"].map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => insertVariable(v)}
                                    className="px-1.5 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 rounded font-mono"
                                >
                                    + {v}
                                </button>
                            ))}
                        </div>

                        {/* Message Textarea */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Message Text</Label>
                            <Textarea
                                rows={6}
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder="Type your WhatsApp message..."
                                className="text-xs font-sans leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setMessageModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={sendingMsg || !messageText.trim()}
                            onClick={handleSendQuickMessage}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {sendingMsg ? (
                                <>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-1.5 h-3.5 w-3.5" /> Send WhatsApp Message
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
