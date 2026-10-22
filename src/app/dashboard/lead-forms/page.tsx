"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
    FileText,
    Plus,
    Sparkles,
    Send,
    Copy,
    Check,
    ExternalLink,
    Trash2,
    Edit3,
    Code2,
    Eye,
    Users,
    Smartphone,
    Palette,
    HelpCircle,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    ArrowRight,
    Layers,
    Bot,
} from "lucide-react";
import { toast } from "sonner";
import type { LeadForm, FormField, FormSubmission, FormTheme, OutreachMode } from "@/lib/forms/types";
import { generateIframeEmbed, generateCustomHtmlCss } from "@/lib/forms/embed-generator";

export default function LeadFormsDashboard() {
    const [forms, setForms] = useState<LeadForm[]>([]);
    const [sessions, setSessions] = useState<{ id: string; sessionId: string; name: string; status: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [origin, setOrigin] = useState("");

    // Modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [embedModalOpen, setEmbedModalOpen] = useState(false);
    const [submissionsModalOpen, setSubmissionsModalOpen] = useState(false);

    // Active editing state
    const [activeForm, setActiveForm] = useState<LeadForm | null>(null);
    const [editorTab, setEditorTab] = useState<"general" | "fields" | "ai" | "styling">("general");
    const [embedTab, setEmbedTab] = useState<"iframe" | "html" | "link">("iframe");
    const [selectedFormForEmbed, setSelectedFormForEmbed] = useState<LeadForm | null>(null);
    const [allSubmissions, setAllSubmissions] = useState<FormSubmission[]>([]);
    const [selectedFormSubmissions, setSelectedFormSubmissions] = useState<FormSubmission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    // Copied indicator
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setOrigin(window.location.origin);
        }
        fetchForms();
    }, []);

    const fetchForms = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/forms");
            const data = await res.json();
            if (data.status) {
                setForms(data.data.forms || []);
                setAllSubmissions(data.data.submissions || []);
                setSessions(data.data.sessions || []);
            } else {
                toast.error(data.message || "Failed to load forms");
            }
        } catch {
            toast.error("Network error loading forms");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleCreateNew = () => {
        const newForm: LeadForm = {
            id: `inbound-${Date.now().toString(36)}`,
            title: "Website Consultation & Quote",
            description: "Submit your details below and our AI specialist will connect with you on WhatsApp!",
            fields: [
                { id: "name", label: "Full Name", type: "text", placeholder: "e.g. Ramesh Kumar", required: true },
                { id: "phone", label: "WhatsApp Number", type: "tel", placeholder: "+91 9935370814", required: true, helpText: "Include country code" },
                { id: "email", label: "Email Address", type: "email", placeholder: "ramesh@example.com", required: false },
                {
                    id: "service",
                    label: "Service Interested In",
                    type: "select",
                    required: true,
                    options: ["Website Development", "WhatsApp API Automation", "SEO & Marketing", "Custom Software"],
                    defaultValue: "Website Development",
                },
                { id: "message", label: "Project Details", type: "textarea", placeholder: "Tell us about your requirements...", required: false },
            ],
            submitButtonText: "Connect on WhatsApp",
            successMessage: "Thank you! Your inquiry was received. Check your WhatsApp for an instant message!",
            redirectUrl: "",
            sessionId: sessions[0]?.sessionId || "",
            leadStage: "NEW",
            leadCategory: "Website Inbound",
            leadTags: ["website", "lead-form"],
            enableAiOutreach: true,
            enableLeadAlerts: true,
            outreachMode: "ai_personalized",
            aiPrompt: "Greet the customer warmly by name. Acknowledge what service they are interested in, highlight our quick delivery and expert support, and ask what day/time works best for a 10-minute demo call.",
            templateMessage: "Hello {{name}}! 👋 Thank you for inquiring about {{service}}. We received your message and our team is excited to help you. When is a good time to discuss your project?",
            theme: "emerald",
            brandColor: "#10B981",
            backgroundColor: "#ffffff",
            textColor: "#0f172a",
            borderRadius: 12,
            viewsCount: 0,
            submissionsCount: 0,
            outreachSentCount: 0,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setActiveForm(newForm);
        setEditModalOpen(true);
    };

    const handleSaveForm = async () => {
        if (!activeForm) return;
        if (!activeForm.title.trim()) {
            toast.error("Form title is required");
            return;
        }
        if (!activeForm.id.trim()) {
            toast.error("Form ID slug is required");
            return;
        }

        try {
            const res = await fetch("/api/forms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(activeForm),
            });
            const result = await res.json();
            if (result.status) {
                toast.success("Form saved successfully!");
                setEditModalOpen(false);
                fetchForms();
            } else {
                toast.error(result.message || "Failed to save form");
            }
        } catch {
            toast.error("Failed to save form");
        }
    };

    const handleDeleteForm = async (id: string) => {
        if (!confirm("Are you sure you want to delete this form?\nExisting CRM leads captured by it will be preserved.")) return;
        try {
            const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
            const result = await res.json();
            if (result.status) {
                toast.success("Form deleted");
                fetchForms();
            } else {
                toast.error(result.message || "Failed to delete form");
            }
        } catch {
            toast.error("Failed to delete form");
        }
    };

    const handleOpenSubmissions = async (form: LeadForm) => {
        setSelectedFormForEmbed(form);
        const localSubs = allSubmissions.filter((s) => s.formId === form.id);
        setSelectedFormSubmissions(localSubs);
        setSubmissionsModalOpen(true);
        setLoadingSubmissions(localSubs.length === 0);
        try {
            const res = await fetch(`/api/forms/${form.id}`);
            const result = await res.json();
            if (result.status && Array.isArray(result.data?.submissions)) {
                if (result.data.submissions.length > 0 || localSubs.length === 0) {
                    setSelectedFormSubmissions(result.data.submissions);
                }
            }
        } catch {
            // Keep localSubs on fetch error
        } finally {
            setLoadingSubmissions(false);
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const totalForms = forms.length;
        const totalSubmissions = forms.reduce((acc, f) => acc + (f.submissionsCount || 0), 0);
        const totalOutreach = forms.reduce((acc, f) => acc + (f.outreachSentCount || 0), 0);
        const activeForms = forms.filter((f) => f.isActive).length;
        return { totalForms, totalSubmissions, totalOutreach, activeForms };
    }, [forms]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-7 w-7 text-emerald-500" />
                        Lead Forms & Instant AI Outreach
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Create custom lead capture forms for client websites. Automatically ingest leads directly into CRM and trigger instant personalized AI WhatsApp outreach.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button variant="outline" size="sm" onClick={fetchForms} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Create Lead Form
                    </Button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Forms</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.totalForms}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Leads Ingested</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.totalSubmissions}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">AI Outreach Sent</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.totalOutreach}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Forms</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.activeForms}</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Forms List Table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="border-b p-5">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <span>Configured Lead Forms</span>
                        <Badge variant="secondary" className="text-xs">{forms.length}</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Manage public forms, customize CSS styling for client themes, and copy 1-click iframe or HTML/CSS embed codes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {forms.length === 0 ? (
                        <div className="p-12 text-center space-y-3">
                            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                                <FileText className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No lead forms created yet</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Create your first form to start capturing leads from client websites directly into your CRM with instant AI WhatsApp outreach.
                            </p>
                            <Button size="sm" onClick={handleCreateNew} className="bg-emerald-600 text-white mt-2">
                                Create Lead Form
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent text-xs uppercase">
                                    <TableHead className="w-[280px]">Form Details</TableHead>
                                    <TableHead>WhatsApp Session</TableHead>
                                    <TableHead>AI Outreach</TableHead>
                                    <TableHead>Submissions</TableHead>
                                    <TableHead>Theme</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {forms.map((form) => {
                                    const sessionObj = sessions.find((s) => s.sessionId === form.sessionId);
                                    const isConnected = sessionObj?.status === "CONNECTED";

                                    return (
                                        <TableRow key={form.id} className="text-sm hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                            <TableCell>
                                                <div className="font-semibold text-slate-900 dark:text-white">{form.title}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {form.id}</div>
                                                {form.description && (
                                                    <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{form.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {form.sessionId ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                            {sessionObj?.name || form.sessionId}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Not Selected</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {form.enableAiOutreach ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] gap-1">
                                                        <Sparkles className="h-3 w-3" />
                                                        {form.outreachMode === "ai_personalized" ? "Smart AI" : "Template"}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 text-[11px]">Disabled</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">{form.submissionsCount || 0}</div>
                                                <div className="text-[11px] text-slate-400">{form.outreachSentCount || 0} messaged</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="capitalize text-xs font-normal">
                                                    {form.theme}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={form.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-slate-100 text-slate-500"}>
                                                    {form.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Copy Embed Snippets"
                                                        onClick={() => {
                                                            setSelectedFormForEmbed(form);
                                                            setEmbedModalOpen(true);
                                                        }}
                                                        className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                    >
                                                        <Code2 className="h-4 w-4 mr-1" />
                                                        Embed
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="View Submissions"
                                                        onClick={() => handleOpenSubmissions(form)}
                                                        className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                    >
                                                        <Users className="h-4 w-4 mr-1" />
                                                        Leads
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Open Form Preview"
                                                        onClick={() => window.open(`/form/${form.id}`, "_blank")}
                                                        className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Edit Form"
                                                        onClick={() => {
                                                            setActiveForm(JSON.parse(JSON.stringify(form)));
                                                            setEditModalOpen(true);
                                                        }}
                                                        className="h-8 w-8 text-slate-500 hover:text-slate-800"
                                                    >
                                                        <Edit3 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Delete Form"
                                                        onClick={() => handleDeleteForm(form.id)}
                                                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Form Editor Dialog */}
            {activeForm && (
                <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-emerald-500" />
                                {activeForm.id.startsWith("inbound-") ? "Create Lead Form" : "Edit Lead Form"}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Configure form fields, connected WhatsApp session, AI outreach prompt, and custom CSS styling.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="w-full mt-2">
                            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                                <button
                                    type="button"
                                    onClick={() => setEditorTab("general")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${editorTab === "general" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    General
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorTab("fields")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${editorTab === "fields" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    Fields
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorTab("ai")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${editorTab === "ai" ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    AI Outreach
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorTab("styling")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${editorTab === "styling" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    <Palette className="h-3.5 w-3.5" />
                                    Theme & Custom CSS
                                </button>
                            </div>

                            {/* Tab 1: General Info */}
                            {editorTab === "general" && (
                                <div className="space-y-4 pt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Form Title *</Label>
                                        <Input
                                            value={activeForm.title}
                                            onChange={(e) => setActiveForm({ ...activeForm, title: e.target.value })}
                                            placeholder="e.g. Website Contact Form"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Form URL Slug / ID *</Label>
                                        <Input
                                            value={activeForm.id}
                                            onChange={(e) => setActiveForm({ ...activeForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })}
                                            placeholder="e.g. contact-us"
                                        />
                                        <p className="text-[10px] text-slate-400">Public link: /form/{activeForm.id}</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Description / Subtitle</Label>
                                    <Textarea
                                        rows={2}
                                        value={activeForm.description || ""}
                                        onChange={(e) => setActiveForm({ ...activeForm, description: e.target.value })}
                                        placeholder="Subtitle shown below the form title"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Submit Button Label</Label>
                                        <Input
                                            value={activeForm.submitButtonText}
                                            onChange={(e) => setActiveForm({ ...activeForm, submitButtonText: e.target.value })}
                                            placeholder="e.g. Connect on WhatsApp"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Redirect URL (Optional)</Label>
                                        <Input
                                            value={activeForm.redirectUrl || ""}
                                            onChange={(e) => setActiveForm({ ...activeForm, redirectUrl: e.target.value })}
                                            placeholder="https://client-website.com/thank-you"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Success Message</Label>
                                    <Textarea
                                        rows={2}
                                        value={activeForm.successMessage}
                                        onChange={(e) => setActiveForm({ ...activeForm, successMessage: e.target.value })}
                                        placeholder="Message shown upon successful submission"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-900">
                                    <div>
                                        <p className="text-xs font-semibold">Form Active Status</p>
                                        <p className="text-[11px] text-slate-400">Enable or pause accepting submissions</p>
                                    </div>
                                    <Switch
                                        checked={activeForm.isActive}
                                        onCheckedChange={(c) => setActiveForm({ ...activeForm, isActive: c })}
                                    />
                                </div>
                                </div>
                            )}

                            {/* Tab 2: Fields */}
                            {editorTab === "fields" && (
                                <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500">Configure input fields collected from prospects.</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const fieldId = `field_${Date.now().toString(36)}`;
                                            const newField: FormField = {
                                                id: fieldId,
                                                label: "New Field",
                                                type: "text",
                                                placeholder: "",
                                                required: false,
                                            };
                                            setActiveForm({
                                                ...activeForm,
                                                fields: [...activeForm.fields, newField],
                                            });
                                        }}
                                        className="text-xs h-8 gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Field
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {activeForm.fields.map((f, idx) => (
                                        <div key={f.id} className="p-3.5 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-4">
                                                    <Label className="text-[11px]">Label</Label>
                                                    <Input
                                                        className="h-8 text-xs"
                                                        value={f.label}
                                                        onChange={(e) => {
                                                            const updated = [...activeForm.fields];
                                                            updated[idx].label = e.target.value;
                                                            setActiveForm({ ...activeForm, fields: updated });
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <Label className="text-[11px]">Type</Label>
                                                    <select
                                                        className="w-full h-8 px-2 rounded-md border text-xs bg-background"
                                                        value={f.type}
                                                        onChange={(e) => {
                                                            const updated = [...activeForm.fields];
                                                            updated[idx].type = e.target.value as any;
                                                            if (e.target.value === "select" && !updated[idx].options) {
                                                                updated[idx].options = ["Option 1", "Option 2"];
                                                            }
                                                            setActiveForm({ ...activeForm, fields: updated });
                                                        }}
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="tel">Phone (WhatsApp)</option>
                                                        <option value="email">Email</option>
                                                        <option value="textarea">Textarea</option>
                                                        <option value="select">Dropdown Select</option>
                                                        <option value="number">Number</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-3">
                                                    <Label className="text-[11px]">Placeholder</Label>
                                                    <Input
                                                        className="h-8 text-xs"
                                                        value={f.placeholder || ""}
                                                        onChange={(e) => {
                                                            const updated = [...activeForm.fields];
                                                            updated[idx].placeholder = e.target.value;
                                                            setActiveForm({ ...activeForm, fields: updated });
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-2 flex items-center justify-end gap-2 pt-4">
                                                    <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={f.required}
                                                            onChange={(e) => {
                                                                const updated = [...activeForm.fields];
                                                                updated[idx].required = e.target.checked;
                                                                setActiveForm({ ...activeForm, fields: updated });
                                                            }}
                                                        />
                                                        Req
                                                    </label>
                                                    {f.id !== "phone" && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                const updated = activeForm.fields.filter((_, i) => i !== idx);
                                                                setActiveForm({ ...activeForm, fields: updated });
                                                            }}
                                                            className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Dropdown Options editor if type is select */}
                                            {f.type === "select" && (
                                                <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                                                    <Label className="text-[11px]">Dropdown Options (comma-separated)</Label>
                                                    <Input
                                                        className="h-8 text-xs mt-1"
                                                        value={f.options?.join(", ") || ""}
                                                        onChange={(e) => {
                                                            const updated = [...activeForm.fields];
                                                            updated[idx].options = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                                            setActiveForm({ ...activeForm, fields: updated });
                                                        }}
                                                        placeholder="e.g. Starter, Growth, Enterprise"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                </div>
                            )}

                            {/* Tab 3: AI WhatsApp Outreach */}
                            {editorTab === "ai" && (
                                <div className="space-y-4 pt-4">
                                <div className="p-4 border rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20 flex items-start gap-3">
                                    <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                                            Instant AI WhatsApp Outreach Engine
                                        </h4>
                                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                                            Whenever a customer submits this form, the AI will immediately compose a personalized greeting and dispatch it to their WhatsApp number using your connected session.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 p-3 border rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border-blue-500/20">
                                    <div className="pr-3">
                                        <p className="text-xs font-semibold">Instant Lead Alert</p>
                                        <p className="text-[11px] text-muted-foreground">Notify your in-app bell when this form gets a lead. Open Lead Forms to review new submissions.</p>
                                    </div>
                                    <Switch
                                        checked={activeForm.enableLeadAlerts !== false}
                                        onCheckedChange={(enabled) => setActiveForm({ ...activeForm, enableLeadAlerts: enabled })}
                                        aria-label="Enable instant lead alerts"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-900">
                                    <div>
                                        <p className="text-xs font-semibold">Enable Instant AI WhatsApp Outreach</p>
                                        <p className="text-[11px] text-slate-400">Send automated message to prospect right upon form submission</p>
                                    </div>
                                    <Switch
                                        checked={activeForm.enableAiOutreach}
                                        onCheckedChange={(c) => setActiveForm({ ...activeForm, enableAiOutreach: c })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Dispatch WhatsApp Session *</Label>
                                        <select
                                            className="w-full h-9 px-3 rounded-md border text-xs bg-background"
                                            value={activeForm.sessionId}
                                            onChange={(e) => setActiveForm({ ...activeForm, sessionId: e.target.value })}
                                        >
                                            <option value="">Select a WhatsApp session...</option>
                                            {sessions.map((s) => (
                                                <option key={s.sessionId} value={s.sessionId}>
                                                    {s.name} ({s.sessionId}) - {s.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Outreach Mode</Label>
                                        <select
                                            className="w-full h-9 px-3 rounded-md border text-xs bg-background"
                                            value={activeForm.outreachMode}
                                            onChange={(e) => setActiveForm({ ...activeForm, outreachMode: e.target.value as OutreachMode })}
                                        >
                                            <option value="ai_personalized">Smart AI (Personalized Generation)</option>
                                            <option value="template">Template Message (Fast / Static)</option>
                                        </select>
                                    </div>
                                </div>

                                {activeForm.outreachMode === "ai_personalized" ? (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">AI Prompt Instructions</Label>
                                        <Textarea
                                            rows={3}
                                            value={activeForm.aiPrompt || ""}
                                            onChange={(e) => setActiveForm({ ...activeForm, aiPrompt: e.target.value })}
                                            placeholder="e.g. Greet by name, pitch our web design and automation services, and ask when they are free for a 10-minute demo call."
                                        />
                                        <p className="text-[11px] text-slate-400">
                                            The AI has full context of what the prospect submitted (service requested, project notes, budget) and tailors the message accordingly.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Template Message</Label>
                                        <Textarea
                                            rows={3}
                                            value={activeForm.templateMessage || ""}
                                            onChange={(e) => setActiveForm({ ...activeForm, templateMessage: e.target.value })}
                                            placeholder="Hello {{name}}! Thank you for inquiring about {{service}}..."
                                        />
                                        <p className="text-[11px] text-slate-400">
                                            Available variables: <code>{"{{name}}"}</code>, <code>{"{{phone}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{service}}"}</code>, <code>{"{{message}}"}</code>
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">CRM Lead Category</Label>
                                        <Input
                                            value={activeForm.leadCategory}
                                            onChange={(e) => setActiveForm({ ...activeForm, leadCategory: e.target.value })}
                                            placeholder="Website Inbound"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Initial CRM Stage</Label>
                                        <select
                                            className="w-full h-9 px-3 rounded-md border text-xs bg-background"
                                            value={activeForm.leadStage}
                                            onChange={(e) => setActiveForm({ ...activeForm, leadStage: e.target.value })}
                                        >
                                            <option value="NEW">NEW (New Leads)</option>
                                            <option value="CONTACTED">CONTACTED</option>
                                            <option value="INTERESTED">INTERESTED</option>
                                            <option value="QUALIFIED">QUALIFIED</option>
                                        </select>
                                    </div>
                                </div>
                                </div>
                            )}

                            {/* Tab 4: Theme & Custom CSS */}
                            {editorTab === "styling" && (
                                <div className="space-y-4 pt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Theme Style</Label>
                                        <select
                                            className="w-full h-9 px-3 rounded-md border text-xs bg-background capitalize"
                                            value={activeForm.theme}
                                            onChange={(e) => setActiveForm({ ...activeForm, theme: e.target.value as FormTheme })}
                                        >
                                            <option value="emerald">Emerald (Modern SaaS)</option>
                                            <option value="dark">Dark Modern</option>
                                            <option value="slate">Slate Corporate</option>
                                            <option value="indigo">Indigo Tech</option>
                                            <option value="minimal">Minimalist (Border-free)</option>
                                            <option value="custom">Custom CSS Pure</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Brand Accent Color</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={activeForm.brandColor || "#10b981"}
                                                onChange={(e) => setActiveForm({ ...activeForm, brandColor: e.target.value })}
                                                className="h-9 w-9 rounded-md border cursor-pointer p-0.5"
                                            />
                                            <Input
                                                className="h-9 text-xs font-mono"
                                                value={activeForm.brandColor || "#10b981"}
                                                onChange={(e) => setActiveForm({ ...activeForm, brandColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Corner Radius (px)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={32}
                                            value={activeForm.borderRadius !== undefined ? activeForm.borderRadius : 12}
                                            onChange={(e) => setActiveForm({ ...activeForm, borderRadius: parseInt(e.target.value, 10) || 0 })}
                                        />
                                    </div>
                                </div>

                                {/* Custom CSS Box */}
                                <div className="space-y-2 border-t pt-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                                            <Code2 className="h-4 w-4 text-emerald-500" />
                                            Custom CSS (Matches Client Website Design & Theme)
                                        </Label>
                                        <Badge variant="secondary" className="text-[10px]">Full Styling Freedom</Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Inject any custom CSS classes to style this form. Target classes: <code>.form-container</code>, <code>.form-input</code>, <code>.form-label</code>, <code>.form-button</code>, <code>.form-title</code>.
                                    </p>
                                    <Textarea
                                        rows={6}
                                        className="font-mono text-xs leading-relaxed bg-slate-900 text-emerald-400 border-slate-800 placeholder:text-slate-600"
                                        value={activeForm.customCss || ""}
                                        onChange={(e) => setActiveForm({ ...activeForm, customCss: e.target.value })}
                                        placeholder={`/* Example custom CSS: */\n.form-title { font-family: 'Poppins', sans-serif; letter-spacing: -0.5px; }\n.form-button { box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39); }\n.form-input { border-radius: 8px; border: 1.5px solid #e2e8f0; }`}
                                    />
                                </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-4 border-t flex items-center justify-between">
                            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSaveForm} className="bg-emerald-600 text-white">
                                Save Lead Form
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Embed Code Modal */}
            {selectedFormForEmbed && (
                <Dialog open={embedModalOpen} onOpenChange={setEmbedModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <Code2 className="h-5 w-5 text-emerald-500" />
                                Embed Code for "{selectedFormForEmbed.title}"
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Copy the embed code to add this lead capture form directly into WordPress, Webflow, Shopify, or any custom website.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="w-full mt-2">
                            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                                <button
                                    type="button"
                                    onClick={() => setEmbedTab("iframe")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${embedTab === "iframe" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    1. Iframe Embed (Easiest)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEmbedTab("html")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${embedTab === "html" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    2. Custom HTML & CSS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEmbedTab("link")}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${embedTab === "link" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                >
                                    3. Direct Share Link
                                </button>
                            </div>

                            {/* Iframe */}
                            {embedTab === "iframe" && (
                                <div className="space-y-3 pt-3">
                                    <p className="text-xs text-slate-500">
                                        Drop this single line of HTML anywhere on your client’s site. It renders seamlessly and automatically handles submissions and AI outreach.
                                    </p>
                                    <div className="relative">
                                        <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 select-all">
                                            {generateIframeEmbed(selectedFormForEmbed, origin)}
                                        </pre>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleCopy(generateIframeEmbed(selectedFormForEmbed, origin), "iframe")}
                                            className="absolute top-2.5 right-2.5 h-7 text-xs gap-1.5"
                                        >
                                            {copiedKey === "iframe" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            {copiedKey === "iframe" ? "Copied" : "Copy Iframe"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* HTML & CSS */}
                            {embedTab === "html" && (
                                <div className="space-y-3 pt-3">
                                    <p className="text-xs text-slate-500">
                                        Standalone HTML + scoped CSS snippet with fetch submission handler. Modify colors, fonts, and styling to match the client website theme 100%.
                                    </p>
                                    <div className="relative">
                                        <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs max-h-72 overflow-y-auto border border-slate-800 select-all">
                                            {generateCustomHtmlCss(selectedFormForEmbed, origin)}
                                        </pre>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleCopy(generateCustomHtmlCss(selectedFormForEmbed, origin), "html")}
                                            className="absolute top-2.5 right-2.5 h-7 text-xs gap-1.5"
                                        >
                                            {copiedKey === "html" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            {copiedKey === "html" ? "Copied" : "Copy HTML & CSS"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Direct Link */}
                            {embedTab === "link" && (
                                <div className="space-y-3 pt-3">
                                    <p className="text-xs text-slate-500">
                                        Direct link to the public responsive form page that can be shared in emails, bio links, or WhatsApp broadcast messages.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            readOnly
                                            value={`${origin}/form/${selectedFormForEmbed.id}`}
                                            className="font-mono text-xs"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() => handleCopy(`${origin}/form/${selectedFormForEmbed.id}`, "link")}
                                            className="gap-1.5 text-xs h-9"
                                        >
                                            {copiedKey === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            Copy
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open(`/form/${selectedFormForEmbed.id}`, "_blank")}
                                            className="h-9 px-2.5"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Submissions List Dialog */}
            {selectedFormForEmbed && (
                <Dialog open={submissionsModalOpen} onOpenChange={setSubmissionsModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-500" />
                                Captured Leads — "{selectedFormForEmbed.title}"
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                All leads captured by this form are synced directly into your CRM with instant WhatsApp outreach logs.
                            </DialogDescription>
                        </DialogHeader>

                        {loadingSubmissions ? (
                            <div className="py-12 text-center text-xs text-slate-400">Loading captured leads...</div>
                        ) : selectedFormSubmissions.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400">No submissions recorded yet for this form.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="text-xs">
                                        <TableHead>Prospect</TableHead>
                                        <TableHead>Phone (WhatsApp)</TableHead>
                                        <TableHead>AI Outreach</TableHead>
                                        <TableHead>Submitted At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedFormSubmissions.map((sub) => (
                                        <TableRow key={sub.id} className="text-xs">
                                            <TableCell>
                                                <div className="font-semibold text-slate-900 dark:text-white">{sub.name || "Inbound Lead"}</div>
                                                {sub.email && <div className="text-slate-400 text-[11px]">{sub.email}</div>}
                                                {sub.data?.service && (
                                                    <span className="inline-block px-1.5 py-0.5 mt-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-medium">
                                                        {sub.data.service}
                                                    </span>
                                                )}
                                                {sub.data?.message && (
                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2 max-w-xs">
                                                        "{sub.data.message}"
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-slate-700 dark:text-slate-300">+{sub.phone}</span>
                                            </TableCell>
                                            <TableCell>
                                                {sub.aiOutreachStatus === "SENT" ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-[10px]">
                                                        ✓ Sent
                                                    </Badge>
                                                ) : sub.aiOutreachStatus === "FAILED" ? (
                                                    <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 text-[10px]">{sub.aiOutreachStatus}</Badge>
                                                )}
                                                {sub.aiOutreachMessage && (
                                                    <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5 italic">
                                                        "{sub.aiOutreachMessage}"
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-400 text-[11px]">
                                                {new Date(sub.createdAt).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
