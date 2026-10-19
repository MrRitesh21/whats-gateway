"use client";

import React, { useState, useEffect } from "react";
import {
    Key, ShieldCheck, CheckCircle2, ExternalLink,
    Sparkles, ArrowRight, AlertCircle, RefreshCw, Lock,
    Globe, HelpCircle, Check, Copy
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ActivateLicensePage() {
    const router = useRouter();
    const [purchaseCode, setPurchaseCode] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [currentHost, setCurrentHost] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [alreadyActive, setAlreadyActive] = useState(false);
    const [successData, setSuccessData] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setCurrentHost(window.location.host);
        }

        fetch("/api/license/status")
            .then((r) => r.json())
            .then((data) => {
                if (data.active) {
                    setAlreadyActive(true);
                    setSuccessData(data);
                }
            })
            .catch(() => { })
            .finally(() => setCheckingStatus(false));
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!purchaseCode.trim()) {
            setError("Please enter your official WAFlow License Key.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/license/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    purchaseCode: purchaseCode.trim(),
                    customerName: customerName.trim(),
                    customerEmail: customerEmail.trim()
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessData(data);
                setTimeout(() => {
                    router.push("/dashboard");
                }, 2000);
            } else {
                setError(data.message || "Failed to activate license. Please verify your purchase code.");
            }
        } catch (err: any) {
            setError(err?.message || "Connection error. Please check your internet and try again.");
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
                <p className="text-sm font-medium">Verifying license state...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[25rem] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-[20rem] h-[20rem] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-2xl mx-auto w-full space-y-8 relative z-10">
                {/* Header Badge */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest shadow-sm">
                        <ShieldCheck size={14} />
                        <span>Source Code License Verification</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        Activate WAFlow WhatsApp
                    </h1>
                    <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                        To protect your installation and access the dashboard and WhatsApp API services, please activate your license key below.
                    </p>
                </div>

                {/* SUCCESS / ALREADY ACTIVATED VIEW */}
                {alreadyActive || successData?.success ? (
                    <div className="bg-slate-900/90 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-xl">
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 size={26} />
                            </div>
                            <div>
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                                    Installation Authorized
                                </span>
                                <h2 className="text-xl font-bold text-white mt-0.5">
                                    Software License is Active!
                                </h2>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-black/60 border border-slate-800 space-y-3 font-mono text-xs">
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="uppercase font-semibold">Authorized Host / Domain:</span>
                                <span className="text-emerald-400 font-bold">{currentHost}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="uppercase font-semibold">Tier:</span>
                                <span className="text-gray-400 font-bold uppercase">
                                    {successData?.licenseType || successData?.license?.licenseType || "Standard Single Domain"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span className="uppercase font-semibold">Engine Status:</span>
                                <span className="text-emerald-400 font-bold">Encrypted Runtime Seal Verified</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push("/dashboard")}
                                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                            >
                                <span>Go to Dashboard</span>
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* MAIN ACTIVATION CARD */
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                        {/* Step 1 Callout Banner */}
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-950/80 to-blue-950/50 border border-emerald-500/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                                    <Sparkles size={15} />
                                    <span>Step 1: Get Your Official License Key</span>
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                                    Required
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Go to <strong className="text-white">lab.WAFlow.com/activate</strong>, choose <span className="text-emerald-400 font-bold">Direct / Agency</span> (or CodeCanyon), select <strong className="text-white">WhatsGateway</strong>, and complete the quick form to receive your official <code className="bg-black/60 px-1.5 py-0.5 rounded text-emerald-400 font-mono">WEBOT-WA-XXXX</code> license key.
                            </p>
                            <a
                                href="https://lab.WAFlow.com/activate"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition cursor-pointer shadow-md"
                            >
                                <span>Open lab.WAFlow.com/activate</span>
                                <ExternalLink size={13} />
                            </a>
                        </div>

                        {/* Step 2 Form */}
                        <form onSubmit={handleActivate} className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider pt-2">
                                <Lock size={14} className="text-emerald-400" />
                                <span>Step 2: Enter & Authorize License</span>
                            </div>

                            {error && (
                                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                                    <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                                    <div className="leading-relaxed">{error}</div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Official WAFlow License Key <span className="text-emerald-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={purchaseCode}
                                        onChange={(e) => setPurchaseCode(e.target.value)}
                                        placeholder="e.g. WEBOT-WA-REG-XXXX-XXXX-XXXX"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-400 font-bold uppercase"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Key size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Licensee Name (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Your Name / Company"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Licensee Email (Optional)
                                    </label>
                                    <input
                                        type="email"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        placeholder="admin@yourdomain.com"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                                <span className="flex items-center gap-1.5">
                                    <Globe size={13} className="text-emerald-400" />
                                    Target Domain:
                                </span>
                                <span className="text-white font-bold">{currentHost || "localhost"}</span>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        <span>Validating with WAFlow Lab...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={16} />
                                        <span>Authorize & Unlock Dashboard</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Footer Disclaimer */}
                <div className="text-center text-[11px] text-slate-500 font-medium">
                    WAFlow WhatsApp &copy; {new Date().getFullYear()} WAFlow Lab. All rights reserved. Single-domain commercial software license.
                </div>
            </div>
        </div>
    );
}
