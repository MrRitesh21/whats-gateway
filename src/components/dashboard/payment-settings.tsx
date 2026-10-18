"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, CreditCard, Loader2, Zap, Copy, Check, QrCode, ChevronDown, ChevronUp, Sparkles, Smartphone } from "lucide-react";
import { toast } from "sonner";

// Payment Gateway Settings Card — rendered ONLY for SUPERADMIN.
export function PaymentSettingsCard() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"youpi" | "klikqris">("youpi");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // YouPI secrets state
    const [youpiSecretSet, setYoupiSecretSet] = useState(false);
    const [youpiSecretMasked, setYoupiSecretMasked] = useState<string | null>(null);

    // KlikQRIS secrets state
    const [klikKeySet, setKlikKeySet] = useState(false);
    const [klikKeyMasked, setKlikKeyMasked] = useState<string | null>(null);

    const [form, setForm] = useState({
        activePaymentGateway: "youpi",
        // Direct UPI (Zero configuration mode)
        youpiUpiId: "",
        youpiPayeeName: "WhatsFlow",
        youpiAutoApprove: true,
        // YouPI-PG Server (Advanced observer mode)
        youpiApiUrl: "http://localhost:7000",
        youpiMerchantId: "",
        youpiWebhookSecret: "",
        youpiEnabled: true,
        // KlikQRIS
        klikqrisBaseUrl: "https://klikqris.com/api",
        klikqrisMerchantId: "",
        klikqrisApiKey: "",
        klikqrisEnabled: false
    });

    const webhookUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/api/billing/webhook/youpi`
            : "/api/billing/webhook/youpi";

    const load = () => {
        setLoading(true);
        fetch("/api/settings/payment")
            .then((r) => r.json())
            .then((res) => {
                if (res.status && res.data) {
                    setForm((f) => ({
                        ...f,
                        activePaymentGateway: res.data.activePaymentGateway || "youpi",
                        // Direct UPI
                        youpiUpiId: res.data.youpiUpiId || "",
                        youpiPayeeName: res.data.youpiPayeeName || "WhatsFlow",
                        youpiAutoApprove: res.data.youpiAutoApprove ?? true,
                        // YouPI-PG Server
                        youpiApiUrl: res.data.youpiApiUrl || "http://localhost:7000",
                        youpiMerchantId: res.data.youpiMerchantId || "",
                        youpiWebhookSecret: "",
                        youpiEnabled: res.data.youpiEnabled ?? true,
                        // KlikQRIS
                        klikqrisBaseUrl: res.data.klikqrisBaseUrl || "https://klikqris.com/api",
                        klikqrisMerchantId: res.data.klikqrisMerchantId || "",
                        klikqrisEnabled: !!res.data.klikqrisEnabled,
                        klikqrisApiKey: ""
                    }));
                    setActiveTab(res.data.activePaymentGateway === "klikqris" ? "klikqris" : "youpi");
                    setYoupiSecretSet(!!res.data.youpiWebhookSecretSet);
                    setYoupiSecretMasked(res.data.youpiWebhookSecretMasked || null);
                    setKlikKeySet(!!res.data.klikqrisApiKeySet);
                    setKlikKeyMasked(res.data.klikqrisApiKeyMasked || null);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedWebhook(true);
        toast.success("Webhook URL copied to clipboard");
        setTimeout(() => setCopiedWebhook(false), 2000);
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload: any = {
                activePaymentGateway: form.activePaymentGateway,
                // Direct UPI
                youpiUpiId: form.youpiUpiId,
                youpiPayeeName: form.youpiPayeeName,
                youpiAutoApprove: form.youpiAutoApprove,
                // YouPI-PG Server
                youpiApiUrl: form.youpiApiUrl,
                youpiMerchantId: form.youpiMerchantId,
                youpiEnabled: form.youpiEnabled,
                // KlikQRIS
                klikqrisBaseUrl: form.klikqrisBaseUrl,
                klikqrisMerchantId: form.klikqrisMerchantId,
                klikqrisEnabled: form.klikqrisEnabled
            };

            if (form.youpiWebhookSecret.trim() !== "") {
                payload.youpiWebhookSecret = form.youpiWebhookSecret.trim();
            }
            if (form.klikqrisApiKey.trim() !== "") {
                payload.klikqrisApiKey = form.klikqrisApiKey.trim();
            }

            const res = await fetch("/api/settings/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.status) {
                toast.success("Payment settings saved successfully");
                setForm((f) => ({ ...f, youpiWebhookSecret: "", klikqrisApiKey: "" }));
                load();
            } else {
                toast.error(data.message || "Failed to save payment settings");
            }
        } catch {
            toast.error("Failed to save payment settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="border shadow-sm">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Zap className="h-5 w-5 text-amber-500 fill-amber-500" /> UPI Payment Gateway
                        </CardTitle>
                        <CardDescription>
                            Accept instant 0%-fee UPI payments directly to your bank account via QR code & UPI apps.
                        </CardDescription>
                    </div>

                    {/* Gateway selection tabs */}
                    <div className="flex items-center bg-muted p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab("youpi")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === "youpi"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Zap className="h-3.5 w-3.5 text-amber-500" /> UPI (India ₹)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("klikqris")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === "klikqris"
                                    ? "bg-background text-foreground shadow-sm font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <QrCode className="h-3.5 w-3.5 text-blue-500" /> KlikQRIS (Indonesia Rp)
                        </button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {activeTab === "youpi" ? (
                    <div className="space-y-5">
                        {/* Status Toggle & Simple Setup Banner */}
                        <div className="flex items-center justify-between rounded-2xl border p-4 bg-amber-500/5 border-amber-500/20">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <Sparkles className="h-4 w-4 text-amber-500" /> Enable UPI Payments
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Simply enter your UPI ID below. Dynamic QR codes and 1-tap app links will generate automatically!
                                </p>
                            </div>
                            <Switch
                                checked={form.youpiEnabled}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, youpiEnabled: v }))}
                            />
                        </div>

                        {/* Primary UPI Details (What the user needs!) */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold flex items-center gap-1.5">
                                    <Smartphone className="h-4 w-4 text-emerald-600" /> Your UPI ID / VPA <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={form.youpiUpiId}
                                    onChange={(e) => setForm((f) => ({ ...f, youpiUpiId: e.target.value }))}
                                    placeholder="e.g. ritesh@okhdfcbank or 9876543210@paytm"
                                    className="font-medium h-11"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Direct receiving UPI ID where customers send subscription payments.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Payee / Business Name
                                </Label>
                                <Input
                                    value={form.youpiPayeeName}
                                    onChange={(e) => setForm((f) => ({ ...f, youpiPayeeName: e.target.value }))}
                                    placeholder="e.g. WhatsFlow or DigiWil"
                                    className="h-11"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Name displayed on the customer's phone when opening GPay/PhonePe.
                                </p>
                            </div>
                        </div>

                        {/* Auto-activation feature */}
                        <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/30">
                            <div className="space-y-0.5 pr-4">
                                <Label className="text-sm font-semibold">Instant Activation on UTR Submission</Label>
                                <p className="text-xs text-muted-foreground">
                                    When enabled, customer enters their 12-digit UTR from GPay / PhonePe / Paytm and their subscription activates instantly.
                                </p>
                            </div>
                            <Switch
                                checked={form.youpiAutoApprove}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, youpiAutoApprove: v }))}
                            />
                        </div>

                        {/* Advanced YouPI-PG Server Integration (Collapsed by default!) */}
                        <div className="rounded-xl border border-border/80 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between p-3.5 bg-muted/40 hover:bg-muted/60 text-left text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                                    Advanced: Self-Hosted YouPI-PG Gateway Server (Optional)
                                </span>
                                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {showAdvanced && (
                                <div className="p-4 space-y-4 border-t bg-card">
                                    <p className="text-xs text-muted-foreground">
                                        Only needed if you are running an automated <strong>YouPI-PG server instance</strong> with Android APK SMS/Gmail observers for automatic payment verification.
                                    </p>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">YouPI-PG Gateway Base URL</Label>
                                        <Input
                                            value={form.youpiApiUrl}
                                            onChange={(e) => setForm((f) => ({ ...f, youpiApiUrl: e.target.value }))}
                                            placeholder="http://localhost:7000 or https://pay.yourdomain.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Merchant ID (X-Merchant-Id)</Label>
                                        <Input
                                            value={form.youpiMerchantId}
                                            onChange={(e) => setForm((f) => ({ ...f, youpiMerchantId: e.target.value }))}
                                            placeholder="e.g. merchant_dev_demo"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Webhook Secret (HMAC-SHA256)</Label>
                                        <Input
                                            type="password"
                                            value={form.youpiWebhookSecret}
                                            onChange={(e) => setForm((f) => ({ ...f, youpiWebhookSecret: e.target.value }))}
                                            placeholder={
                                                youpiSecretSet
                                                    ? `Saved (${youpiSecretMasked || "••••"}) — enter new to change`
                                                    : "Enter webhook secret for HMAC signature verification"
                                            }
                                        />
                                    </div>

                                    <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 border">
                                        <Label className="text-xs font-semibold">Webhook Destination URL</Label>
                                        <div className="flex items-center justify-between gap-2 font-mono text-xs text-foreground bg-background px-3 py-2 rounded-md border break-all">
                                            <span>{webhookUrl}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => copyToClipboard(webhookUrl)}
                                            >
                                                {copiedWebhook ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* KlikQRIS Configuration */
                    <div className="space-y-4 rounded-xl border p-4 bg-card">
                        <div className="flex items-center justify-between pb-3 border-b">
                            <div>
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    <QrCode className="h-4 w-4 text-blue-500" /> Enable KlikQRIS
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Indonesian QRIS payment gateway for IDR (Rp) payments.
                                </p>
                            </div>
                            <Switch
                                checked={form.klikqrisEnabled}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, klikqrisEnabled: v }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>KlikQRIS Base URL</Label>
                            <Input
                                value={form.klikqrisBaseUrl}
                                onChange={(e) => setForm((f) => ({ ...f, klikqrisBaseUrl: e.target.value }))}
                                placeholder="https://klikqris.com/api"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Merchant ID (id_merchant)</Label>
                            <Input
                                value={form.klikqrisMerchantId}
                                onChange={(e) => setForm((f) => ({ ...f, klikqrisMerchantId: e.target.value }))}
                                placeholder="YOUR_MERCHANT_ID"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>API Key (x-api-key)</Label>
                            <Input
                                type="password"
                                value={form.klikqrisApiKey}
                                onChange={(e) => setForm((f) => ({ ...f, klikqrisApiKey: e.target.value }))}
                                placeholder={
                                    klikKeySet ? `Saved (${klikKeyMasked || "••••"}) — enter new to replace` : "YOUR_API_KEY"
                                }
                            />
                        </div>
                    </div>
                )}

                <Button onClick={save} disabled={saving || loading} className="w-full h-11 text-sm font-semibold">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Payment Gateway Settings
                </Button>
            </CardContent>
        </Card>
    );
}
