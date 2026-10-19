"use client";

// Editor plan & pricing untuk SUPERADMIN. Mengubah harga, limit, dan benefit
// yang ditampilkan di halaman pricing + dipakai untuk pembatasan kuota API.
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Save, Tag, CheckCheck, XCircle, Search, Sliders, MessageSquare, Users, Cpu, Code2 } from "lucide-react";
import { toast } from "sonner";
import { CAPABILITIES, Capability, CapabilityCategory, CapabilityDef } from "@/lib/plans";

interface Plan {
    id: string;
    name: string;
    price: number | null;
    durationDays: number;
    dailyLimit: number;
    monthlyLimit: number;
    maxSessions: number;
    highlight?: boolean;
    capabilities?: Record<string, boolean>;
    features: string[];
}

const CATEGORIES: { name: CapabilityCategory; icon: React.ElementType }[] = [
    { name: "Messaging", icon: MessageSquare },
    { name: "Contacts & CRM", icon: Users },
    { name: "Automation & AI", icon: Cpu },
    { name: "Developer & Tools", icon: Code2 },
];

const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function PlanEditorCard() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
    const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/settings/plans")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.data) setPlans(d.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const update = (idx: number, patch: Partial<Plan>) => {
        setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    };

    const toggleCap = (idx: number, capId: string, val: boolean) => {
        setPlans((prev) =>
            prev.map((p, i) =>
                i === idx ? { ...p, capabilities: { ...(p.capabilities || {}), [capId]: val } } : p
            )
        );
    };

    const toggleAllCapabilities = (idx: number, enable: boolean) => {
        const updated: Record<string, boolean> = {};
        for (const cap of CAPABILITIES) {
            updated[cap.id] = enable;
        }
        setPlans((prev) =>
            prev.map((p, i) => (i === idx ? { ...p, capabilities: updated } : p))
        );
        toast.info(enable ? `All features enabled for ${plans[idx]?.name || plans[idx]?.id}` : `All features disabled for ${plans[idx]?.name || plans[idx]?.id}`);
    };

    const toggleCategoryCapabilities = (idx: number, category: CapabilityCategory, enable: boolean) => {
        const targetCaps = CAPABILITIES.filter((c) => c.category === category);
        setPlans((prev) =>
            prev.map((p, i) => {
                if (i !== idx) return p;
                const caps = { ...(p.capabilities || {}) };
                for (const c of targetCaps) {
                    caps[c.id] = enable;
                }
                return { ...p, capabilities: caps };
            })
        );
    };

    const save = async () => {
        setSaving(true);
        try {
            const body: Record<string, Partial<Plan>> = {};
            for (const p of plans) {
                body[p.id] = {
                    name: p.name,
                    price: p.price,
                    durationDays: p.durationDays,
                    dailyLimit: p.dailyLimit,
                    monthlyLimit: p.monthlyLimit,
                    maxSessions: p.maxSessions,
                    highlight: p.highlight,
                    capabilities: p.capabilities,
                    features: p.features,
                };
            }
            const res = await fetch("/api/settings/plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) toast.success("Plan configuration saved. Pricing page updated immediately.");
            else toast.error("Failed to save plan configuration");
        } catch {
            toast.error("Error saving plan configuration");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Tag className="h-5 w-5 text-blue-500" /> Plans & Pricing Management
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Configure pricing, API limits, and granular feature toggles for each subscription plan.
                            Limit <b>-1</b> = unlimited; price <b>empty</b> = custom; <b>0</b> = free.
                        </CardDescription>
                    </div>
                    <Button onClick={save} disabled={saving || loading} className="shrink-0 gap-2">
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save All Plans
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading && <p className="text-sm text-muted-foreground">Loading plans…</p>}

                {plans.map((p, idx) => {
                    const activeCapCount = CAPABILITIES.filter((c) => p.capabilities?.[c.id] !== false).length;
                    const activeFilter = selectedCategory[p.id] || "ALL";
                    const searchQuery = (searchQueries[p.id] || "").toLowerCase().trim();

                    const visibleCaps = CAPABILITIES.filter((c) => {
                        if (activeFilter !== "ALL" && c.category !== activeFilter) return false;
                        if (searchQuery && !c.label.toLowerCase().includes(searchQuery) && !c.description.toLowerCase().includes(searchQuery)) return false;
                        return true;
                    });

                    return (
                        <div key={p.id} className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
                            {/* Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-foreground tracking-tight">{p.id}</span>
                                    <Badge variant="secondary" className="font-semibold">
                                        {p.name}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className={`text-xs ${
                                            activeCapCount === CAPABILITIES.length
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                : activeCapCount === 0
                                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                        }`}
                                    >
                                        {activeCapCount} / {CAPABILITIES.length} Features Active
                                    </Badge>
                                </div>
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                                    <span>Mark as Most Popular</span>
                                    <Switch
                                        checked={!!p.highlight}
                                        onCheckedChange={(c) => update(idx, { highlight: c })}
                                    />
                                </label>
                            </div>

                            {/* Numeric & Details Config */}
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Plan Name</Label>
                                    <input
                                        className={inputClass}
                                        value={p.name}
                                        onChange={(e) => update(idx, { name: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Price (₹/mo)</Label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        placeholder="empty = Custom"
                                        value={p.price ?? ""}
                                        onChange={(e) =>
                                            update(idx, { price: e.target.value === "" ? null : Number(e.target.value) })
                                        }
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Duration (days)</Label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={p.durationDays}
                                        onChange={(e) => update(idx, { durationDays: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Daily Limit (-1=∞)</Label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={p.dailyLimit}
                                        onChange={(e) => update(idx, { dailyLimit: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Monthly Limit (-1=∞)</Label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={p.monthlyLimit}
                                        onChange={(e) => update(idx, { monthlyLimit: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-1">
                                    <Label className="text-xs font-medium">Max Sessions (-1=∞)</Label>
                                    <input
                                        className={inputClass}
                                        type="number"
                                        value={p.maxSessions}
                                        onChange={(e) => update(idx, { maxSessions: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* Granular Capabilities Toggles */}
                            <div className="space-y-3 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-lg border border-border/50">
                                    <div>
                                        <Label className="text-sm font-semibold flex items-center gap-1.5">
                                            <Sliders className="h-4 w-4 text-primary" /> Features (on/off) — benefits + access control
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Toggle any feature on or off. Disabled features are hidden from the user's sidebar and gated from access.
                                        </p>
                                    </div>

                                    {/* Action Buttons: Enable All / Disable All */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleAllCapabilities(idx, true)}
                                            className="h-7 px-2.5 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30"
                                        >
                                            <CheckCheck className="h-3.5 w-3.5" /> Enable All
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleAllCapabilities(idx, false)}
                                            className="h-7 px-2.5 text-xs gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30"
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Disable All
                                        </Button>
                                    </div>
                                </div>

                                {/* Filter Tabs & Search Bar */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedCategory((prev) => ({ ...prev, [p.id]: "ALL" }))}
                                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                                activeFilter === "ALL"
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                            }`}
                                        >
                                            All ({CAPABILITIES.length})
                                        </button>
                                        {CATEGORIES.map((cat) => {
                                            const catCount = CAPABILITIES.filter((c) => c.category === cat.name).length;
                                            const catActive = CAPABILITIES.filter(
                                                (c) => c.category === cat.name && p.capabilities?.[c.id] !== false
                                            ).length;
                                            const Icon = cat.icon;
                                            return (
                                                <button
                                                    key={cat.name}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedCategory((prev) => ({ ...prev, [p.id]: cat.name }))
                                                    }
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                                        activeFilter === cat.name
                                                            ? "bg-primary text-primary-foreground shadow-sm"
                                                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                    }`}
                                                >
                                                    <Icon className="h-3 w-3" />
                                                    <span>{cat.name}</span>
                                                    <span className="opacity-70 text-[10px]">
                                                        ({catActive}/{catCount})
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Search feature */}
                                    <div className="relative w-full md:w-56 shrink-0">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Filter features..."
                                            value={searchQueries[p.id] || ""}
                                            onChange={(e) =>
                                                setSearchQueries((prev) => ({ ...prev, [p.id]: e.target.value }))
                                            }
                                            className="h-8 pl-8 pr-3 text-xs w-full rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                        />
                                    </div>
                                </div>

                                {/* Capability Toggle Grid */}
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 rounded-lg border border-border/60 bg-muted/20 max-h-[460px] overflow-y-auto styled-scrollbar">
                                    {visibleCaps.length === 0 ? (
                                        <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                                            No features match the filter or search.
                                        </div>
                                    ) : (
                                        visibleCaps.map((cap) => {
                                            const isEnabled = p.capabilities?.[cap.id] !== false;
                                            return (
                                                <div
                                                    key={cap.id}
                                                    className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border transition-all ${
                                                        isEnabled
                                                            ? "bg-card border-border hover:border-primary/40 shadow-xs"
                                                            : "bg-muted/40 border-dashed border-border/50 opacity-60 hover:opacity-90"
                                                    }`}
                                                >
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-semibold text-foreground truncate">
                                                                {cap.label}
                                                            </span>
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-muted text-muted-foreground shrink-0">
                                                                {cap.category}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                                                            {cap.description}
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={(c) => toggleCap(idx, cap.id, c)}
                                                        className="shrink-0 mt-0.5"
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Additional Benefits (Free Text) */}
                            <div className="grid gap-1 pt-1">
                                <Label className="text-xs font-medium">
                                    Additional benefits & bullet points (free text, one per line)
                                </Label>
                                <textarea
                                    className={`${inputClass} h-20 py-2 font-mono text-xs`}
                                    value={(p.features || []).join("\n")}
                                    onChange={(e) => update(idx, { features: e.target.value.split("\n") })}
                                    placeholder="e.g. Dedicated Support\nCustom onboarding\n99.9% Uptime SLA"
                                />
                            </div>
                        </div>
                    );
                })}

                <Button onClick={save} disabled={saving || loading} className="w-full sm:w-auto gap-2">
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Plans & Pricing
                </Button>
            </CardContent>
        </Card>
    );
}
