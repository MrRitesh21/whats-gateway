"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Check, Sparkles, Loader2, RefreshCw, X, ExternalLink, Zap, Smartphone, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, PLAN_ORDER, formatIDR, type PlanId } from "@/lib/plans";

interface UsageData {
    plan: PlanId;
    planName: string;
    planExpiresAt: string | null;
    dayCount: number;
    monthCount: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyRemaining: number;
    monthlyRemaining: number;
}

interface CheckoutData {
    paymentId: string;
    reference?: string;
    plan: PlanId;
    planName: string;
    amount: number;
    totalAmount?: number | null;
    currency?: string;
    provider?: string;
    checkoutUrl?: string | null;
    qrString: string | null;
    qrImageUrl: string | null;
    expiresAt: string | null;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
    const unlimited = limit < 0;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">
                    {used.toLocaleString("en-IN")} / {unlimited ? "∞" : limit.toLocaleString("en-IN")}
                </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${unlimited ? 4 : pct}%` }}
                />
            </div>
        </div>
    );
}

export default function BillingPage() {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkout, setCheckout] = useState<CheckoutData | null>(null);
    const [buying, setBuying] = useState<PlanId | null>(null);
    const [polling, setPolling] = useState(false);
    const [utrInput, setUtrInput] = useState("");
    const [submittingUtr, setSubmittingUtr] = useState(false);

    const loadUsage = useCallback(async () => {
        try {
            const res = await fetch("/api/usage");
            const json = await res.json();
            if (json.status) setUsage(json.data);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsage();
    }, [loadUsage]);

    // Polling payment status
    useEffect(() => {
        if (!checkout) return;
        setPolling(true);
        let active = true;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/billing/status/${checkout.paymentId}`);
                const json = await res.json();
                if (!active) return;
                const status = json?.data?.paymentStatus;
                if (status === "PAID") {
                    clearInterval(interval);
                    setPolling(false);
                    toast.success(`Payment successful! Plan ${checkout.planName} is now active 🎉`);
                    setCheckout(null);
                    setUtrInput("");
                    loadUsage();
                } else if (["EXPIRED", "FAILED", "CANCELLED"].includes(status)) {
                    clearInterval(interval);
                    setPolling(false);
                    toast.error(`Payment ${status.toLowerCase()}. Please try again.`);
                    setCheckout(null);
                }
            } catch {
                /* ignore */
            }
        }, 3500);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [checkout, loadUsage]);

    const handleBuy = async (plan: PlanId) => {
        const cfg = PLANS[plan];
        if (plan === "FREE") return;
        if (cfg.price === null) {
            toast.info("Enterprise plan is custom. Please contact support or sales.");
            return;
        }
        setBuying(plan);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan })
            });
            const json = await res.json();
            if (!json.status) {
                toast.error(json.message || "Failed to create transaction");
                return;
            }
            if (!json.data.qrString && !json.data.qrImageUrl && !json.data.checkoutUrl) {
                toast.error("Gateway did not return payment information. Check payment configuration.");
                return;
            }
            setCheckout(json.data);
            setUtrInput("");
        } catch (e: any) {
            toast.error(e?.message || "Failed to create transaction");
        } finally {
            setBuying(null);
        }
    };

    const handleSubmitUtr = async () => {
        if (!checkout || !utrInput.trim()) return;
        setSubmittingUtr(true);
        try {
            const res = await fetch("/api/billing/utr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentId: checkout.paymentId,
                    utr: utrInput.trim()
                })
            });
            const json = await res.json();
            if (json.status) {
                toast.success(json.message || "Payment verified successfully! 🎉");
                setCheckout(null);
                setUtrInput("");
                loadUsage();
            } else {
                toast.error(json.message || "Invalid UTR reference number");
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to submit UTR");
        } finally {
            setSubmittingUtr(false);
        }
    };

    const qrValue = checkout?.qrString || checkout?.checkoutUrl || "";

    return (
        <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
                <p className="text-muted-foreground">Manage your subscription, payments, and view your API usage.</p>
            </div>

            {/* Current plan + usage */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Current Plan</CardTitle>
                        <CardDescription>
                            {loading ? "Loading..." : `${usage?.planName || "Free"}`}
                            {usage?.planExpiresAt
                                ? ` · active until ${new Date(usage.planExpiresAt).toLocaleDateString()}`
                                : ""}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadUsage} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                    {usage ? (
                        <>
                            <UsageBar label="Requests today" used={usage.dayCount} limit={usage.dailyLimit} />
                            <UsageBar label="Requests this month" used={usage.monthCount} limit={usage.monthlyLimit} />
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Loading usage...</p>
                    )}
                </CardContent>
            </Card>

            {/* Checkout / QR panel */}
            {checkout && (
                <Card className="border-primary shadow-lg ring-1 ring-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-xl">Pay for {checkout.planName}</CardTitle>
                                {checkout.provider === "youpi" ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                        <Zap className="h-3 w-3 fill-amber-500 text-amber-500" /> Direct UPI (0% Fee)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                        <QrCode className="h-3 w-3" /> KlikQRIS
                                    </span>
                                )}
                            </div>
                            <CardDescription>
                                Scan the dynamic QR code with any UPI app (GPay, PhonePe, Paytm, CRED) or click below to open your UPI app.
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setCheckout(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-5">
                        <div className="bg-white p-5 rounded-2xl shadow-inner border max-w-full overflow-hidden flex items-center justify-center">
                            {qrValue ? (
                                <QRCodeSVG value={qrValue} size={240} className="max-w-full h-auto" />
                            ) : checkout.qrImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={checkout.qrImageUrl}
                                    alt="Payment QR"
                                    width={240}
                                    height={240}
                                    className="max-w-full h-auto object-contain"
                                />
                            ) : null}
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-3xl font-extrabold tracking-tight">
                                {formatIDR(checkout.totalAmount ?? checkout.amount)}
                            </p>
                            {checkout.totalAmount && checkout.totalAmount !== checkout.amount && (
                                <p className="text-xs text-muted-foreground">
                                    Base price {formatIDR(checkout.amount)} + fee/unique code
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 pt-1">
                                {polling && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                Waiting for UPI payment confirmation...
                            </p>
                        </div>

                        {/* Action buttons for YouPI / UPI intents */}
                        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md pt-1">
                            {checkout.qrString && checkout.qrString.startsWith("upi://") && (
                                <Button
                                    asChild
                                    className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <a href={checkout.qrString}>
                                        <Smartphone className="mr-2 h-4 w-4" /> Open in UPI App (GPay/PhonePe)
                                    </a>
                                </Button>
                            )}

                            {checkout.checkoutUrl && (
                                <Button
                                    variant="outline"
                                    className="w-full sm:w-auto flex-1"
                                    onClick={() => window.open(checkout.checkoutUrl!, "_blank", "width=600,height=800")}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Checkout Portal
                                </Button>
                            )}
                        </div>

                        {/* Instant UTR Activation Form */}
                        <div className="w-full max-w-md pt-3 border-t">
                            <div className="bg-muted/40 p-4 rounded-xl border space-y-3">
                                <div>
                                    <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                                        <Check className="h-4 w-4 text-emerald-600" /> Done with payment? Enter 12-Digit UTR
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Enter the 12-digit UPI UTR / Transaction Ref No. from your GPay, PhonePe, or Paytm receipt for instant activation.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={utrInput}
                                        onChange={(e) => setUtrInput(e.target.value)}
                                        placeholder="e.g. 428912345678"
                                        className="font-mono text-sm bg-background"
                                        maxLength={22}
                                    />
                                    <Button
                                        onClick={handleSubmitUtr}
                                        disabled={submittingUtr || !utrInput.trim()}
                                        className="shrink-0 font-semibold"
                                    >
                                        {submittingUtr ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Activate"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Plans */}
            <div>
                <h2 className="text-lg font-semibold mb-4">Choose a Plan</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {PLAN_ORDER.map((id) => {
                        const plan = PLANS[id];
                        const isCurrent = usage?.plan === id;
                        const isFree = plan.price === 0;
                        const isCustom = plan.price === null;
                        return (
                            <div
                                key={id}
                                className={`relative flex flex-col p-6 rounded-2xl border ${plan.highlight ? "ring-2 ring-primary" : "border-border"}`}
                            >
                                {plan.highlight && (
                                    <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-xl bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                                        <Sparkles className="h-3 w-3" /> Popular
                                    </div>
                                )}
                                <h3 className="font-bold">{plan.name}</h3>
                                <div className="mt-2 mb-3">
                                    <span className="text-2xl font-extrabold">{formatIDR(plan.price)}</span>
                                    {!isFree && !isCustom && (
                                        <span className="text-muted-foreground text-xs">/month</span>
                                    )}
                                </div>
                                <ul className="space-y-2 mb-5 flex-1">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-xs text-foreground/80">
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="w-full"
                                    variant={plan.highlight ? "default" : "outline"}
                                    disabled={isCurrent || isFree || buying !== null}
                                    onClick={() => handleBuy(id)}
                                >
                                    {buying === id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isCurrent ? (
                                        "Active Plan"
                                    ) : isFree ? (
                                        "Default"
                                    ) : isCustom ? (
                                        "Contact Us"
                                    ) : (
                                        "Upgrade"
                                    )}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
