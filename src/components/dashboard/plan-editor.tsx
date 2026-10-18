"use client";

// Editor plan & pricing untuk SUPERADMIN. Mengubah harga, limit, dan benefit
// yang ditampilkan di halaman pricing + dipakai untuk pembatasan kuota API.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Save, Tag } from "lucide-react";
import { toast } from "sonner";

const CAPABILITIES: { id: string; label: string }[] = [
    { id: "autoReply", label: "Auto Reply" },
    { id: "broadcast", label: "Broadcast" },
    { id: "autoBroadcast", label: "Auto Broadcast" },
    { id: "scheduler", label: "Scheduler" },
    { id: "webhook", label: "Webhook & API Events" },
    { id: "jpm", label: "JPM SW GC" },
    { id: "sticker", label: "Sticker Maker" },
];

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

const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function PlanEditorCard() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" /> Plans & Pricing
                </CardTitle>
                <CardDescription>
                    SUPERADMIN only. Configure pricing, limits, and capabilities for each plan. Changes
                    immediately reflect on the pricing page and API rate limits.
                    Limit <b>-1</b> = unlimited; price <b>empty</b> = custom; <b>0</b> = free.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading && <p className="text-sm text-muted-foreground">Loading plans…</p>}

                {plans.map((p, idx) => (
                    <div key={p.id} className="rounded-lg border border-border/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">{p.id}</span>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                Most Popular
                                <Switch
                                    checked={!!p.highlight}
                                    onCheckedChange={(c) => update(idx, { highlight: c })}
                                />
                            </label>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-3">
                            <div className="grid gap-1">
                                <Label className="text-xs">Name</Label>
                                <input className={inputClass} value={p.name}
                                    onChange={(e) => update(idx, { name: e.target.value })} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Price / month (empty = custom)</Label>
                                <input className={inputClass} type="number" value={p.price ?? ""}
                                    onChange={(e) => update(idx, { price: e.target.value === "" ? null : Number(e.target.value) })} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Duration (days)</Label>
                                <input className={inputClass} type="number" value={p.durationDays}
                                    onChange={(e) => update(idx, { durationDays: Number(e.target.value) })} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Limit / day (-1 = unlimited)</Label>
                                <input className={inputClass} type="number" value={p.dailyLimit}
                                    onChange={(e) => update(idx, { dailyLimit: Number(e.target.value) })} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Limit / month (-1 = unlimited)</Label>
                                <input className={inputClass} type="number" value={p.monthlyLimit}
                                    onChange={(e) => update(idx, { monthlyLimit: Number(e.target.value) })} />
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-xs">Max sessions (-1 = unlimited)</Label>
                                <input className={inputClass} type="number" value={p.maxSessions}
                                    onChange={(e) => update(idx, { maxSessions: Number(e.target.value) })} />
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-xs">Features (on/off) — benefits + access control</Label>
                            <div className="grid sm:grid-cols-2 gap-2 rounded-md border border-border/50 p-3">
                                {CAPABILITIES.map((cap) => (
                                    <label key={cap.id} className="flex items-center justify-between gap-2 text-sm">
                                        <span>{cap.label}</span>
                                        <Switch
                                            checked={p.capabilities?.[cap.id] !== false}
                                            onCheckedChange={(c) => toggleCap(idx, cap.id, c)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-xs">Additional benefits (free text, one per line)</Label>
                            <textarea
                                className={`${inputClass} h-24 py-2`}
                                value={(p.features || []).join("\n")}
                                onChange={(e) => update(idx, { features: e.target.value.split("\n") })}
                            />
                        </div>
                    </div>
                ))}

                <Button onClick={save} disabled={saving || loading}>
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Plans & Pricing
                </Button>
            </CardContent>
        </Card>
    );
}
