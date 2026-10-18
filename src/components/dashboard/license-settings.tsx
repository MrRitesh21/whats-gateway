"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { KeyRound, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function LicenseSettingsCard() {
    const [licenseKey, setLicenseKey] = useState("WEBOT-REG-B146-CDE0-562B");
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchStatus = () => {
        fetch("/api/license/status")
            .then(r => r.json())
            .then(data => {
                setStatus(data);
                if (data.maskedCode) {
                    setLicenseKey("WEBOT-REG-B146-CDE0-562B");
                }
            })
            .catch(() => {});
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleUpdate = async () => {
        if (!licenseKey.trim()) {
            toast.error("Please enter a valid license key");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/license/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    purchaseCode: licenseKey.trim(),
                    customerName: "Super Admin",
                    customerEmail: "ritesh@digiwil.com"
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("License updated & verified successfully!");
                fetchStatus();
            } else {
                toast.error(data.message || "Failed to update license");
            }
        } catch {
            toast.error("Network error while updating license");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                            License & Software Activation
                        </CardTitle>
                        <CardDescription>
                            SuperAdmin License Key Management. Controls source code activation status and features.
                        </CardDescription>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active & Unlocked
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Official License / Purchase Key</Label>
                        <div className="relative">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                placeholder="WEBOT-REG-XXXX-XXXX-XXXX"
                            />
                            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">Your verified purchase license code.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label>License Type</Label>
                        <div className="flex h-10 items-center px-3 rounded-md border border-input bg-muted/40 text-sm font-medium">
                            {status?.licenseType ? status.licenseType.toUpperCase() : "EXTENDED / ENTERPRISE"}
                        </div>
                        <p className="text-xs text-muted-foreground">Domain: {status?.licensedDomain || "Unlimited / All"}</p>
                    </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                    <Button onClick={handleUpdate} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Save & Authorize Key
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
