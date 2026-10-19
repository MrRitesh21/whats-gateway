"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
    Cpu,
    Plus,
    RefreshCw,
    Trash2,
    Edit3,
    CheckCircle2,
    XCircle,
    Zap,
    BookOpen,
    Play,
    Bot,
    Server,
    ShieldAlert,
    Gauge,
    Sparkles,
    Search,
    Clock,
    FileText,
    Key,
    Activity,
    Info,
    ExternalLink,
    Radio,
    Shuffle,
    Save,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/dashboard/session-provider";

interface AccountItem {
    id: string;
    name: string;
    provider: string;
    apiKey: string;
    baseUrl?: string;
    model: string;
    priority: number;
    weight: number;
    isActive: boolean;
    rateLimitCooldownUntil?: number;
    lastError?: string;
    lastTestedAt?: string;
    lastUsedAt?: string;
    stats: {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        avgLatencyMs: number;
    };
}

interface GatewayConfig {
    routingStrategy: "priority_fallback" | "round_robin" | "least_latency";
    defaultSystemPrompt: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
}

interface RAGConfig {
    topK: number;
    minScore: number;
    chunkSize: number;
    chunkOverlap: number;
    enableWhatsAppAutoReply: boolean;
    whatsappSessions: string[];
    systemInstructions: string;
    fallbackMessage: string;
}

interface KnowledgeDoc {
    id: string;
    title: string;
    category: string;
    content: string;
    tags: string[];
    isActive: boolean;
    chunkCount?: number;
    charCount?: number;
    updatedAt: string;
}

const PROVIDER_OPTIONS = [
    { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
    { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", placeholder: "AIzaSy..." },
    { value: "anthropic", label: "Anthropic Claude", defaultModel: "claude-3-5-sonnet-20241022", placeholder: "sk-ant-..." },
    { value: "groq", label: "Groq (Ultra-Fast)", defaultModel: "openai/gpt-oss-120b", placeholder: "gsk_..." },
    { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat", placeholder: "sk-..." },
    { value: "openrouter", label: "OpenRouter", defaultModel: "meta-llama/llama-3.1-8b-instruct:free", placeholder: "sk-or-..." },
    { value: "ollama", label: "Ollama (Local AI)", defaultModel: "llama3", placeholder: "http://localhost:11434" },
    { value: "custom", label: "Custom OpenAI-Compatible", defaultModel: "default", placeholder: "sk-..." },
];

export default function AIGatewayPage() {
    const { sessions } = useSession();
    const [activeTab, setActiveTab] = useState<"accounts" | "knowledge" | "simulator" | "whatsapp">("accounts");
    const [loading, setLoading] = useState(true);

    // Gateway & Accounts state
    const [accounts, setAccounts] = useState<AccountItem[]>([]);
    const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
        routingStrategy: "priority_fallback",
        defaultSystemPrompt: "",
        temperature: 0.7,
        maxTokens: 1024,
        timeoutMs: 25000,
    });
    const [ragConfig, setRagConfig] = useState<RAGConfig>({
        topK: 4,
        minScore: 0.15,
        chunkSize: 450,
        chunkOverlap: 60,
        enableWhatsAppAutoReply: false,
        whatsappSessions: [],
        systemInstructions: "",
        fallbackMessage: "",
    });

    // Documents state
    const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
    const [docSearch, setDocSearch] = useState("");

    // Account Modal State
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [accountForm, setAccountForm] = useState<Partial<AccountItem>>({
        name: "",
        provider: "openai",
        apiKey: "",
        baseUrl: "",
        model: "gpt-4o-mini",
        priority: 1,
        weight: 1,
        isActive: true,
    });
    const [testingId, setTestingId] = useState<string | null>(null);

    // Document Modal State
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [savingDoc, setSavingDoc] = useState(false);
    const [docForm, setDocForm] = useState<Partial<KnowledgeDoc>>({
        title: "",
        category: "Customer Support",
        content: "",
        tags: [],
        isActive: true,
    });
    const [tagsInput, setTagsInput] = useState("");

    // Simulator State
    const [simQuestion, setSimQuestion] = useState("What are your business hours and main features?");
    const [simUseRAG, setSimUseRAG] = useState(true);
    const [simAccountId, setSimAccountId] = useState("auto");
    const [simLoading, setSimLoading] = useState(false);
    const [simResult, setSimResult] = useState<any>(null);

    // Fetch initial data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [gwRes, docRes] = await Promise.all([
                fetch("/api/ai-gateway"),
                fetch("/api/ai-gateway/rag/documents"),
            ]);
            const gwData = await gwRes.json();
            const docData = await docRes.json();

            if (gwData.status) {
                setAccounts(gwData.data.accounts || []);
                if (gwData.data.gatewayConfig) setGatewayConfig(gwData.data.gatewayConfig);
                if (gwData.data.ragConfig) setRagConfig(gwData.data.ragConfig);
            }
            if (docData.status) {
                setDocuments(docData.data || []);
            }
        } catch {
            toast.error("Failed to load AI Gateway configuration");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Provider change helper in account modal
    const handleProviderChange = (providerVal: string) => {
        const prov = PROVIDER_OPTIONS.find((p) => p.value === providerVal);
        setAccountForm((prev) => ({
            ...prev,
            provider: providerVal,
            model: prov?.defaultModel || prev.model || "default",
            baseUrl: providerVal === "ollama" ? "http://localhost:11434" : prev.baseUrl || "",
        }));
    };

    // Save Account
    const handleSaveAccount = async () => {
        if (!accountForm.name?.trim()) {
            return toast.error("Account name is required");
        }
        if (!accountForm.apiKey?.trim() && accountForm.provider !== "ollama" && !accountForm.id) {
            return toast.error("API Key is required");
        }

        try {
            const res = await fetch("/api/ai-gateway", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "save_account",
                    account: accountForm,
                }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message);
                setAccountModalOpen(false);
                fetchData();
            } else {
                toast.error(data.message || "Failed to save account");
            }
        } catch {
            toast.error("Network error while saving account");
        }
    };

    // Delete Account
    const handleDeleteAccount = async (id: string) => {
        if (!confirm("Are you sure you want to remove this AI account?")) return;
        try {
            const res = await fetch(`/api/ai-gateway?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.status) {
                toast.success("Account removed");
                setAccounts((prev) => prev.filter((a) => a.id !== id));
            } else {
                toast.error(data.message || "Failed to remove");
            }
        } catch {
            toast.error("Failed to delete account");
        }
    };

    // Test Connection
    const handleTestAccount = async (account: AccountItem) => {
        setTestingId(account.id);
        try {
            const res = await fetch("/api/ai-gateway/test-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId: account.id }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(`Connection verified (${data.latencyMs}ms)`);
            } else {
                toast.error(data.message || "Connection test failed");
            }
        } catch {
            toast.error("Network error testing connection");
        } finally {
            setTestingId(null);
        }
    };

    // Save Gateway Settings
    const handleSaveGatewayConfig = async (newConfig: Partial<GatewayConfig>) => {
        const merged = { ...gatewayConfig, ...newConfig };
        setGatewayConfig(merged);
        try {
            const res = await fetch("/api/ai-gateway", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_gateway_config",
                    config: newConfig,
                }),
            });
            const data = await res.json();
            if (data.status) toast.success("Routing strategy updated");
        } catch {
            toast.error("Failed to update settings");
        }
    };

    // Save Document
    const handleSaveDocument = async () => {
        if (!docForm.title?.trim() || !docForm.content?.trim()) {
            return toast.error("Title and Content are required");
        }
        const parsedTags = tagsInput
            .split(/[,]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

        setSavingDoc(true);
        try {
            const res = await fetch("/api/ai-gateway/rag/documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...docForm,
                    tags: parsedTags,
                }),
            });
            const data = await res.json();
            if (data.status) {
                toast.success(data.message || "Document saved and indexed successfully");
                setDocModalOpen(false);
                fetchData();
            } else {
                toast.error(data.message || "Failed to save document");
            }
        } catch {
            toast.error("Failed to save document");
        } finally {
            setSavingDoc(false);
        }
    };

    // Delete Document
    const handleDeleteDocument = async (id: string) => {
        if (!confirm("Delete this document from knowledge base?")) return;
        try {
            const res = await fetch(`/api/ai-gateway/rag/documents?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.status) {
                toast.success("Document deleted");
                setDocuments((prev) => prev.filter((d) => d.id !== id));
            } else {
                toast.error(data.message || "Failed to delete");
            }
        } catch {
            toast.error("Failed to delete document");
        }
    };

    // Save WhatsApp Auto-Reply Config
    const handleSaveRAGSettings = async (updates: Partial<RAGConfig>) => {
        const merged = { ...ragConfig, ...updates };
        setRagConfig(merged);
        try {
            const res = await fetch("/api/ai-gateway", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update_rag_config",
                    config: updates,
                }),
            });
            const data = await res.json();
            if (data.status) toast.success("AI WhatsApp settings saved");
        } catch {
            toast.error("Failed to save settings");
        }
    };

    // Execute Simulator
    const handleRunSimulator = async () => {
        if (!simQuestion.trim()) return toast.error("Please enter a question");
        setSimLoading(true);
        setSimResult(null);
        try {
            const res = await fetch("/api/ai-gateway/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: simQuestion.trim(),
                    useRAG: simUseRAG,
                    specificAccountId: simAccountId === "auto" ? undefined : simAccountId,
                }),
            });
            const data = await res.json();
            if (data.status) {
                setSimResult(data.data);
                toast.success(`Response generated in ${data.data.latencyMs}ms`);
            } else {
                toast.error(data.message || "AI Gateway failed");
            }
        } catch (e: any) {
            toast.error(e.message || "Network error");
        } finally {
            setSimLoading(false);
        }
    };

    const activeAccountsCount = accounts.filter((a) => a.isActive).length;
    const filteredDocs = documents.filter((d) => {
        if (!docSearch.trim()) return true;
        const q = docSearch.toLowerCase();
        return (
            d.title.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q) ||
            d.tags?.some((t) => t.toLowerCase().includes(q))
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Cpu className="h-5 w-5" />
                        </div>
                        Smart AI RAG &amp; AI Gateway
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Connect multiple AI providers, accounts, and keys with auto-failover, load balancing &amp; knowledge retrieval.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-xl border text-xs">
                        <Server className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{activeAccountsCount}</span>
                        <span className="text-muted-foreground">Active Accounts</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-xl border text-xs">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="font-semibold">{documents.length}</span>
                        <span className="text-muted-foreground">Knowledge Docs</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 h-8">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-border/40 pb-2 overflow-x-auto no-scrollbar smooth-touch-scroll -mx-2 px-2 sm:mx-0 sm:px-0">
                {[
                    { id: "accounts", label: "AI Gateway & Accounts", icon: Key, badge: accounts.length },
                    { id: "knowledge", label: "Smart RAG Knowledge Base", icon: BookOpen, badge: documents.length },
                    { id: "simulator", label: "Playground & Simulator", icon: Play },
                    { id: "whatsapp", label: "WhatsApp Bot Integration", icon: Bot },
                ].map(({ id, label, icon: Icon, badge }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id as any)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeTab === id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                            }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                        {badge !== undefined && (
                            <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ─── TAB 1: AI GATEWAY & ACCOUNTS ────────────────────────────────────────── */}
            {activeTab === "accounts" && (
                <div className="space-y-6">
                    {/* Routing Strategy Card */}
                    <Card className="border-border/60 bg-gradient-to-r from-blue-500/[0.03] to-indigo-500/[0.03]">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Gauge className="h-4 w-4 text-primary" /> Multi-Account Routing Strategy
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Choose how requests are routed and failover across your connected accounts.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={gatewayConfig.routingStrategy}
                                        onValueChange={(val: any) => handleSaveGatewayConfig({ routingStrategy: val })}
                                    >
                                        <SelectTrigger className="w-[220px] h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="priority_fallback">
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldAlert className="h-3.5 w-3.5 text-blue-500" />
                                                    Priority Fallback Chain
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="round_robin">
                                                <div className="flex items-center gap-1.5">
                                                    <Shuffle className="h-3.5 w-3.5 text-indigo-500" />
                                                    Round-Robin Balancer
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="least_latency">
                                                <div className="flex items-center gap-1.5">
                                                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                                                    Least Latency Optimizer
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                                <div className="p-3 bg-background rounded-xl border border-border/40">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                                        <ShieldAlert className="h-3.5 w-3.5 text-blue-500" /> Priority Fallback
                                    </div>
                                    Calls Priority #1 first. If rate-limited (429) or error occurs, instantly cascades to Priority #2, #3, etc.
                                </div>
                                <div className="p-3 bg-background rounded-xl border border-border/40">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                                        <Shuffle className="h-3.5 w-3.5 text-indigo-500" /> Round-Robin
                                    </div>
                                    Distributes incoming WhatsApp messages and API queries evenly across all active accounts and keys.
                                </div>
                                <div className="p-3 bg-background rounded-xl border border-border/40">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                                        <Zap className="h-3.5 w-3.5 text-amber-500" /> Least Latency
                                    </div>
                                    Prioritizes fastest responding provider (e.g. Groq ultra-low latency) with fallback on load spikes.
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accounts List Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold">Connected AI Accounts</h3>
                            <p className="text-xs text-muted-foreground">
                                Add OpenAI, Google Gemini, Anthropic Claude, Groq, DeepSeek, or Ollama keys.
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                setAccountForm({
                                    name: `Account #${accounts.length + 1}`,
                                    provider: "openai",
                                    apiKey: "",
                                    baseUrl: "",
                                    model: "gpt-4o-mini",
                                    priority: accounts.length + 1,
                                    weight: 1,
                                    isActive: true,
                                });
                                setAccountModalOpen(true);
                            }}
                            size="sm"
                            className="gap-1.5"
                        >
                            <Plus className="h-4 w-4" /> Add AI Account
                        </Button>
                    </div>

                    {/* Accounts Grid */}
                    {accounts.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <Cpu className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                <p className="text-sm font-semibold">No AI accounts connected yet</p>
                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                    Add your first API key (OpenAI, Gemini, Groq, DeepSeek, Claude, or Ollama) to start routing smart AI responses.
                                </p>
                                <Button
                                    size="sm"
                                    onClick={() => setAccountModalOpen(true)}
                                    className="mt-4 gap-1.5"
                                >
                                    <Plus className="h-4 w-4" /> Add Account Now
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {accounts.map((acc) => {
                                const isTesting = testingId === acc.id;
                                const isCoolingDown = acc.rateLimitCooldownUntil && acc.rateLimitCooldownUntil > Date.now();

                                return (
                                    <Card
                                        key={acc.id}
                                        className={`transition-all border-border/60 hover:border-primary/40 ${!acc.isActive ? "opacity-60 bg-muted/20" : ""
                                            }`}
                                    >
                                        <CardHeader className="pb-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="relative flex h-2 w-2 shrink-0">
                                                            {acc.isActive ? (
                                                                <>
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                                </>
                                                            ) : (
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground" />
                                                            )}
                                                        </span>
                                                        <h4 className="font-semibold text-sm truncate">{acc.name}</h4>
                                                    </div>
                                                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">
                                                        {acc.provider} • {acc.model}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="font-mono text-[10px] shrink-0"
                                                >
                                                    Priority #{acc.priority}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3 pt-1">
                                            {/* Key preview & status */}
                                            <div className="flex items-center justify-between text-xs bg-muted/40 rounded-lg p-2 border border-border/30">
                                                <span className="font-mono text-[11px] text-muted-foreground truncate">
                                                    {acc.apiKey || "(No Key - Local)"}
                                                </span>
                                                {isCoolingDown && (
                                                    <Badge variant="destructive" className="text-[9px] shrink-0">
                                                        429 Cooldown
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Metrics */}
                                            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                                                <div className="p-1.5 bg-muted/30 rounded-lg">
                                                    <div className="font-bold text-foreground">
                                                        {acc.stats?.totalCalls || 0}
                                                    </div>
                                                    <div className="text-[9px] text-muted-foreground">Calls</div>
                                                </div>
                                                <div className="p-1.5 bg-muted/30 rounded-lg">
                                                    <div className="font-bold text-emerald-600">
                                                        {acc.stats?.successfulCalls || 0}
                                                    </div>
                                                    <div className="text-[9px] text-muted-foreground">Success</div>
                                                </div>
                                                <div className="p-1.5 bg-muted/30 rounded-lg">
                                                    <div className="font-bold text-primary font-mono">
                                                        {acc.stats?.avgLatencyMs ? `${acc.stats.avgLatencyMs}ms` : "—"}
                                                    </div>
                                                    <div className="text-[9px] text-muted-foreground">Avg Latency</div>
                                                </div>
                                            </div>

                                            {acc.lastError && (
                                                <p className="text-[10px] text-red-500 truncate" title={acc.lastError}>
                                                    Last err: {acc.lastError}
                                                </p>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-between pt-1 border-t border-border/30">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isTesting}
                                                    onClick={() => handleTestAccount(acc)}
                                                    className="h-7 text-xs px-2 gap-1 text-blue-600 hover:text-blue-700"
                                                >
                                                    <Radio className={`h-3 w-3 ${isTesting ? "animate-spin" : ""}`} />
                                                    {isTesting ? "Testing..." : "Test Key"}
                                                </Button>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setAccountForm(acc);
                                                            setAccountModalOpen(true);
                                                        }}
                                                        className="h-7 w-7 p-0"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteAccount(acc.id)}
                                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB 2: SMART RAG KNOWLEDGE BASE ─────────────────────────────────────── */}
            {activeTab === "knowledge" && (
                <div className="space-y-6">
                    {/* Knowledge Base Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold">Knowledge Base Documents</h3>
                            <p className="text-xs text-muted-foreground">
                                Add documents, catalogs, guidelines, or FAQs that the AI retrieves to answer questions accurately.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search knowledge..."
                                    value={docSearch}
                                    onChange={(e) => setDocSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs w-[180px] sm:w-[220px]"
                                />
                            </div>
                            <Button
                                onClick={() => {
                                    setDocForm({
                                        title: "",
                                        category: "General FAQ",
                                        content: "",
                                        tags: [],
                                        isActive: true,
                                    });
                                    setTagsInput("");
                                    setDocModalOpen(true);
                                }}
                                size="sm"
                                className="gap-1.5 h-8"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Document
                            </Button>
                        </div>
                    </div>

                    {/* Documents List */}
                    {filteredDocs.length === 0 ? (
                        <Card className="border-dashed border-2">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                                <p className="text-sm font-semibold">No knowledge documents found</p>
                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                    Add your company FAQs, product specs, or terms of service so AI can answer customer queries with zero hallucinations.
                                </p>
                                <Button
                                    size="sm"
                                    onClick={() => setDocModalOpen(true)}
                                    className="mt-4 gap-1.5"
                                >
                                    <Plus className="h-4 w-4" /> Add Knowledge Document
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredDocs.map((doc) => (
                                <Card key={doc.id} className="border-border/60 hover:border-indigo-500/40 transition-all">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                                                    <h4 className="font-semibold text-sm truncate">{doc.title}</h4>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    Category: <span className="font-medium text-foreground">{doc.category}</span>
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] shrink-0">
                                                {doc.chunkCount || 1} chunks
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-1">
                                        <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/30 p-2.5 rounded-lg border border-border/30 whitespace-pre-wrap font-sans">
                                            {doc.content}
                                        </p>

                                        {doc.tags && doc.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {doc.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800/40"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                                            <span className="text-[10px] text-muted-foreground">
                                                {doc.charCount || doc.content.length} characters
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setDocForm(doc);
                                                        setTagsInput(doc.tags?.join(", ") || "");
                                                        setDocModalOpen(true);
                                                    }}
                                                    className="h-7 w-7 p-0"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteDocument(doc.id)}
                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB 3: PLAYGROUND & SIMULATOR ───────────────────────────────────────── */}
            {activeTab === "simulator" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Input controls */}
                    <div className="space-y-4 lg:col-span-1">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" /> Test AI Gateway Query
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Simulate incoming customer questions to test failover &amp; RAG answers.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">Target Account</Label>
                                    <Select value={simAccountId} onValueChange={setSimAccountId}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">
                                                ✨ Smart Gateway (Auto Failover)
                                            </SelectItem>
                                            {accounts.map((a) => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.name} ({a.provider})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/40">
                                    <div>
                                        <p className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                                            Smart RAG Search
                                        </p>
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                            Retrieve relevant context from Knowledge Base
                                        </p>
                                    </div>
                                    <Switch checked={simUseRAG} onCheckedChange={setSimUseRAG} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">User Question</Label>
                                    <Textarea
                                        value={simQuestion}
                                        onChange={(e) => setSimQuestion(e.target.value)}
                                        rows={4}
                                        placeholder="Type a customer question..."
                                        className="text-xs resize-none"
                                    />
                                </div>

                                <Button
                                    className="w-full h-10 text-xs font-semibold gap-2"
                                    onClick={handleRunSimulator}
                                    disabled={simLoading}
                                >
                                    {simLoading ? (
                                        <>
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing AI Call...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-3.5 w-3.5" /> Run Smart AI Gateway
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Results display */}
                    <div className="space-y-4 lg:col-span-2">
                        {simResult ? (
                            <div className="space-y-4">
                                {/* Response Card */}
                                <Card className="border-primary/40 bg-gradient-to-br from-primary/[0.02] to-indigo-500/[0.02]">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Bot className="h-5 w-5 text-primary" /> Generated AI Response
                                            </CardTitle>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="font-mono text-[10px] text-emerald-600 border-emerald-500/30">
                                                    {simResult.latencyMs}ms
                                                </Badge>
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {simResult.accountUsed?.name} ({simResult.accountUsed?.model})
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-4 bg-background rounded-xl border border-border/50 text-sm whitespace-pre-wrap leading-relaxed">
                                            {simResult.answer}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Retrieved Chunks */}
                                {simResult.retrievedChunks && simResult.retrievedChunks.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                                Retrieved Knowledge Chunks ({simResult.retrievedChunks.length})
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {simResult.retrievedChunks.map((chunk: any, i: number) => (
                                                <div key={i} className="p-3 bg-muted/40 rounded-xl border border-border/40 text-xs space-y-1">
                                                    <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                                                        <span>Source {i + 1}: {chunk.docTitle}</span>
                                                        <Badge variant="outline" className="text-[9px]">
                                                            Relevance: {chunk.score}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-muted-foreground whitespace-pre-wrap">
                                                        {chunk.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <Card className="h-full flex items-center justify-center p-12 text-center text-muted-foreground border-dashed">
                                <div className="space-y-2 max-w-sm">
                                    <Sparkles className="h-8 w-8 mx-auto opacity-30 text-primary" />
                                    <p className="text-sm font-semibold">Simulator Ready</p>
                                    <p className="text-xs">
                                        Enter any customer question on the left and click "Run Smart AI Gateway" to see real-time failover, RAG retrieval &amp; generated answers.
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* ─── TAB 4: WHATSAPP BOT INTEGRATION ─────────────────────────────────────── */}
            {activeTab === "whatsapp" && (
                <div className="space-y-6 max-w-4xl">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" /> WhatsApp Smart AI Auto-Reply
                            </CardTitle>
                            <CardDescription className="text-xs">
                                When a customer sends an incoming WhatsApp message that does not match a keyword rule, the Smart AI RAG engine will automatically generate an accurate response!
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Master Toggle */}
                            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                                <div>
                                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                        Enable AI RAG Auto-Reply for WhatsApp
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Automatically replies to 1-on-1 chats using Knowledge Base context + Anti-Ban humanizer typing presence.
                                    </p>
                                </div>
                                <Switch
                                    checked={ragConfig.enableWhatsAppAutoReply}
                                    onCheckedChange={(val) => handleSaveRAGSettings({ enableWhatsAppAutoReply: val })}
                                />
                            </div>

                            {/* Session Binding */}
                            <div className="space-y-2.5">
                                <Label className="text-xs font-semibold">
                                    Active WhatsApp Sessions
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Choose which WhatsApp sessions will use Smart AI Auto-Reply (leave empty to apply to all connected sessions):
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {sessions.map((s: any) => {
                                        const isChecked = ragConfig.whatsappSessions?.includes(s.sessionId);
                                        return (
                                            <label
                                                key={s.sessionId}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked
                                                        ? "border-primary/40 bg-primary/5"
                                                        : "border-border/40 hover:bg-muted/30"
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={(checked: boolean) => {
                                                        const updated = checked
                                                            ? [...(ragConfig.whatsappSessions || []), s.sessionId]
                                                            : (ragConfig.whatsappSessions || []).filter((id) => id !== s.sessionId);
                                                        handleSaveRAGSettings({ whatsappSessions: updated });
                                                    }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold truncate">{s.name}</p>
                                                    <p className="text-[10px] font-mono text-muted-foreground truncate">{s.sessionId}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[9px] shrink-0">
                                                    {s.status}
                                                </Badge>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* System Persona Instructions */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">AI System Persona &amp; Tone Instructions</Label>
                                <Textarea
                                    rows={4}
                                    value={ragConfig.systemInstructions}
                                    onChange={(e) => setRagConfig((prev) => ({ ...prev, systemInstructions: e.target.value }))}
                                    onBlur={() => handleSaveRAGSettings({ systemInstructions: ragConfig.systemInstructions })}
                                    placeholder="You are the official customer service assistant for WAFlow..."
                                    className="text-xs resize-none"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Custom instructions for language, tone of voice, emoji usage, and safety guidelines.
                                </p>
                            </div>

                            {/* Fallback Message */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Low Confidence Fallback Message</Label>
                                <Input
                                    value={ragConfig.fallbackMessage}
                                    onChange={(e) => setRagConfig((prev) => ({ ...prev, fallbackMessage: e.target.value }))}
                                    onBlur={() => handleSaveRAGSettings({ fallbackMessage: ragConfig.fallbackMessage })}
                                    placeholder="I'm sorry, I couldn't find that in our knowledge base. Please contact our support team."
                                    className="text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Shown when no relevant knowledge base document matches the query.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ─── MODAL: ADD / EDIT ACCOUNT ────────────────────────────────────────── */}
            <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-4 border-b shrink-0 bg-background">
                        <DialogTitle className="text-base flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-primary" />
                            {accountForm.id ? "Edit AI Account" : "Add AI Account"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Configure an API key and model from any supported AI provider.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0 pr-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Account Label / Friendly Name</Label>
                            <Input
                                value={accountForm.name || ""}
                                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                                placeholder="e.g. OpenAI Production Primary"
                                className="text-xs h-9"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Provider</Label>
                                <Select
                                    value={accountForm.provider || "openai"}
                                    onValueChange={handleProviderChange}
                                >
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDER_OPTIONS.map((p) => (
                                            <SelectItem key={p.value} value={p.value}>
                                                {p.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Model Name</Label>
                                <Input
                                    value={accountForm.model || ""}
                                    onChange={(e) => setAccountForm({ ...accountForm, model: e.target.value })}
                                    placeholder="e.g. openai/gpt-oss-120b"
                                    className="text-xs h-9 font-mono"
                                />
                                {accountForm.provider === "groq" && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {[
                                            { id: "openai/gpt-oss-120b", label: "GPT OSS 120B (Best)" },
                                            { id: "openai/gpt-oss-20b", label: "GPT OSS 20B (Fastest)" },
                                            { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setAccountForm({ ...accountForm, model: m.id })}
                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${accountForm.model === m.id
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/40"
                                                    }`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">API Key</Label>
                            <Input
                                type="password"
                                value={accountForm.apiKey || ""}
                                onChange={(e) => setAccountForm({ ...accountForm, apiKey: e.target.value })}
                                placeholder="Paste API Key here..."
                                className="text-xs h-9 font-mono"
                            />
                        </div>

                        {(accountForm.provider === "ollama" ||
                            accountForm.provider === "custom" ||
                            accountForm.provider === "openrouter" ||
                            accountForm.provider === "openai") && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Base URL (Optional)</Label>
                                    <Input
                                        value={accountForm.baseUrl || ""}
                                        onChange={(e) => setAccountForm({ ...accountForm, baseUrl: e.target.value })}
                                        placeholder={accountForm.provider === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1"}
                                        className="text-xs h-9 font-mono"
                                    />
                                </div>
                            )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Priority (1 = Highest)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={accountForm.priority || 1}
                                    onChange={(e) => setAccountForm({ ...accountForm, priority: Number(e.target.value) })}
                                    className="text-xs h-9"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-0 sm:pt-6">
                                <Label className="text-xs cursor-pointer">Account Active</Label>
                                <Switch
                                    checked={accountForm.isActive !== false}
                                    onCheckedChange={(val) => setAccountForm({ ...accountForm, isActive: val })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t shrink-0 flex flex-row items-center justify-end gap-2 bg-muted/20">
                        <Button variant="outline" size="sm" onClick={() => setAccountModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveAccount}>
                            Save Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL: ADD / EDIT DOCUMENT ───────────────────────────────────────── */}
            <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-4 border-b shrink-0 bg-background">
                        <DialogTitle className="text-base flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-indigo-500" />
                            {docForm.id ? "Edit Knowledge Document" : "Add Knowledge Document"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Documents are automatically split into semantic chunks for smart retrieval.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0 pr-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Document Title</Label>
                                <Input
                                    value={docForm.title || ""}
                                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                                    placeholder="e.g. Return Policy & Warranty"
                                    className="text-xs h-9"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Category</Label>
                                <Input
                                    value={docForm.category || ""}
                                    onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                                    placeholder="e.g. Customer Support"
                                    className="text-xs h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Keywords / Tags (comma separated)</Label>
                            <Input
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder="refund, warranty, return, policy"
                                className="text-xs h-9"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Knowledge Content (Text or Markdown)</Label>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                    {(docForm.content || "").length} characters
                                </span>
                            </div>
                            <Textarea
                                rows={8}
                                value={docForm.content || ""}
                                onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                                placeholder="Paste details, product catalogs, FAQ questions and answers..."
                                className="text-xs font-sans min-h-[160px] max-h-[300px] resize-y"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t shrink-0 flex flex-row items-center justify-end gap-2 bg-muted/20">
                        <Button variant="outline" size="sm" onClick={() => setDocModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveDocument}
                            disabled={savingDoc}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                        >
                            {savingDoc ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5 mr-1.5" />
                                    {docForm.id ? "Save Changes" : "Save & Index Document"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
