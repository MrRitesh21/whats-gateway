"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Sparkles, Copy, Check, ExternalLink, Bot, Key, 
    Terminal, RefreshCw, Eye, EyeOff, ShieldCheck, 
    MessageSquare, CheckCircle2, Cpu
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function McpSettingsPage() {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            setOrigin(window.location.origin);
        }

        // Fetch user API Key
        fetch("/api/user/api-key")
            .then(res => res.json())
            .then(data => {
                if (data.status && data.data?.apiKey) {
                    setApiKey(data.data.apiKey);
                }
            })
            .catch(() => {});
    }, []);

    const mcpUrl = origin 
        ? `${origin}/mcp?key=${apiKey || "YOUR_API_KEY"}`
        : "https://your-domain.com/mcp?key=YOUR_API_KEY";

    const claudeConfig = JSON.stringify({
        mcpServers: {
            whatsapp: {
                url: mcpUrl
            }
        }
    }, null, 2);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(mcpUrl);
        setCopiedUrl(true);
        toast.success("MCP Endpoint URL copied to clipboard!");
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(claudeConfig);
        setCopiedJson(true);
        toast.success("Claude Desktop configuration copied to clipboard!");
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const handleTestConnection = async () => {
        if (!apiKey) {
            toast.error("Please generate an API Key first in Webhooks & API page.");
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`/mcp?key=${encodeURIComponent(apiKey)}`);
            const data = await res.json();
            if (data.protocol || data.status === "active") {
                setTestResult({ success: true, data });
                toast.success("MCP Server connection verified successfully!");
            } else {
                setTestResult({ success: false, data });
                toast.error("Unexpected MCP response.");
            }
        } catch (e: any) {
            setTestResult({ success: false, error: e.message || "Failed to reach /mcp" });
            toast.error("Failed to connect to MCP endpoint.");
        } finally {
            setTesting(false);
        }
    };

    const tools = [
        { name: "whatsapp_send_message", desc: "Send WhatsApp text messages to any phone number or group JID.", params: "phone, message, sessionId?" },
        { name: "whatsapp_list_sessions", desc: "List all connected WhatsApp devices/sessions, phone numbers, and battery status.", params: "none" },
        { name: "whatsapp_get_chats", desc: "Retrieve active conversations, contact names, and recent message previews.", params: "sessionId?, limit?" },
        { name: "whatsapp_get_messages", desc: "Read recent chat message history for any contact or phone number.", params: "phone, sessionId?, limit?" },
        { name: "whatsapp_check_number", desc: "Verify if a phone number is registered and active on WhatsApp.", params: "phone, sessionId?" },
        { name: "whatsapp_list_contacts", desc: "Search and list saved WhatsApp contacts.", params: "sessionId?, query?" },
        { name: "whatsapp_list_groups", desc: "List all WhatsApp groups that the connected account participates in.", params: "sessionId?" },
        { name: "whatsapp_get_account_info", desc: "Inspect user account information, plan, role, and active session limits.", params: "none" }
    ];

    const samplePrompts = [
        "Check if +1 (555) 234-5678 is registered on WhatsApp",
        "Show me my connected WhatsApp devices and their connection status",
        "Send a WhatsApp message to +919876543210 saying your order is confirmed",
        "Read the last 5 messages from +919876543210",
        "List all WhatsApp groups I participate in"
    ];

    return (
        <div className="space-y-6 max-w-6xl pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Model Context Protocol (MCP)</h1>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold gap-1.5 py-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active & Supported
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Connect Claude Desktop, Cursor, Claude Code, or any MCP-compatible AI client directly to your WhatsApp Gateway.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/webhooks">
                            <Key className="h-4 w-4 mr-2 text-amber-500" /> Manage API Key
                        </Link>
                    </Button>
                </div>
            </div>

            {/* MCP Endpoint Card */}
            <Card className="border-emerald-500/20 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-500" /> Your Live MCP Endpoint URL
                        </span>
                        <Badge variant="outline" className="font-mono text-xs">Wassenger-Compatible</Badge>
                    </CardTitle>
                    <CardDescription>
                        Use this endpoint in Claude Desktop, Cursor, or any remote SSE / HTTP MCP client.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-xs sm:text-sm overflow-x-auto border border-slate-800 flex items-center justify-between">
                            <span>
                                {origin ? `${origin}/mcp?key=` : "https://.../mcp?key="}
                                {apiKey ? (
                                    <span className="text-emerald-400 font-bold">
                                        {showApiKey ? apiKey : "••••••••••••••••••••••••"}
                                    </span>
                                ) : (
                                    <span className="text-amber-400">&lt;YOUR_API_KEY&gt;</span>
                                )}
                            </span>
                            {apiKey && (
                                <button 
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="text-slate-400 hover:text-white transition-colors ml-2"
                                    title={showApiKey ? "Hide API Key" : "Reveal API Key"}
                                >
                                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            )}
                        </div>
                        <Button onClick={handleCopyUrl} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                            {copiedUrl ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                            {copiedUrl ? "Copied!" : "Copy URL"}
                        </Button>
                        <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${testing ? "animate-spin" : ""}`} />
                            {testing ? "Verifying..." : "Test Endpoint"}
                        </Button>
                    </div>

                    {!apiKey && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg flex items-center justify-between">
                            <span>⚠️ You do not have an API key generated yet. Generate your key to unlock live MCP communication.</span>
                            <Link href="/dashboard/webhooks" className="font-bold underline text-amber-900 ml-2">
                                Generate Key &rarr;
                            </Link>
                        </div>
                    )}

                    {testResult && (
                        <div className={`p-4 rounded-xl border text-xs font-mono ${testResult.success ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
                            <div className="font-bold mb-1 flex items-center gap-1.5">
                                {testResult.success ? <CheckCircle2 size={14} className="text-emerald-600" /> : "✗"}
                                {testResult.success ? "Connection Verified — MCP Endpoint is LIVE" : "Connection Failed"}
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap mt-2 p-2 bg-white/70 rounded-lg text-[11px]">
                                {JSON.stringify(testResult.data || testResult.error, null, 2)}
                            </pre>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Claude Desktop Config Card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-indigo-500" /> Claude Desktop Configuration
                        </span>
                        <Button size="sm" variant="secondary" onClick={handleCopyJson} className="font-bold text-xs">
                            {copiedJson ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                            {copiedJson ? "Copied JSON!" : "Copy JSON Config"}
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        Paste this snippet into your Claude Desktop configuration file (<code>claude_desktop_config.json</code>).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                        <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                            {claudeConfig}
                        </pre>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2 text-xs text-slate-600">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Terminal size={14} className="text-indigo-600" /> Configuration File Locations:
                        </h4>
                        <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-500">
                            <li><strong>macOS:</strong> ~/Library/Application Support/Claude/claude_desktop_config.json</li>
                            <li><strong>Windows:</strong> %APPDATA%\Claude\claude_desktop_config.json</li>
                            <li><strong>Linux:</strong> ~/.config/Claude/claude_desktop_config.json</li>
                        </ul>
                        <p className="text-[11px] text-slate-500 pt-1">
                            After updating the file, restart Claude Desktop. The 🔨 tool icon will appear automatically.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Available Tools Grid */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Cpu className="h-5 w-5 text-sky-500" /> Available AI Tools (8 Tools)
                    </CardTitle>
                    <CardDescription>
                        Claude and MCP clients automatically have access to these real-time WhatsApp actions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {tools.map((t, i) => (
                            <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <code className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded break-all">
                                        {t.name}
                                    </code>
                                    <Badge variant="secondary" className="text-[10px] bg-sky-50 text-sky-700 shrink-0">Tool</Badge>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    {t.desc}
                                </p>
                                <div className="text-[10px] text-slate-400 font-mono">
                                    Params: {t.params}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Example Prompts */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-gray-500" /> Example Questions to Ask Claude
                    </CardTitle>
                    <CardDescription>
                        Try pasting any of these prompts into Claude once connected:
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {samplePrompts.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    navigator.clipboard.writeText(p);
                                    toast.success(`Copied: "${p}"`);
                                }}
                                className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-left font-medium transition-all flex items-center gap-1.5"
                            >
                                <Copy size={12} className="text-slate-400 flex-shrink-0" />
                                <span>"{p}"</span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
