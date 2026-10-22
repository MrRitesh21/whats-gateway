"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Phone,
    MessageSquare,
    MapPin,
    Clock,
    Star,
    CheckCircle2,
    ShieldCheck,
    Award,
    Sparkles,
    HeartPulse,
    Activity,
    Zap,
    Building2,
    Send,
    ExternalLink,
    ChevronRight,
    Loader2,
    AlertCircle,
    Heart,
} from "lucide-react";
import type { GeneratedSite, SiteService } from "@/lib/sites/types";
import { THEME_CONFIGS } from "@/lib/sites/presets";

// Icon resolver for dynamic service icons
function renderIcon(iconName?: string, className: string = "h-5 w-5") {
    switch (iconName) {
        case "Sparkles": return <Sparkles className={className} />;
        case "Star": return <Star className={className} />;
        case "ShieldCheck": return <ShieldCheck className={className} />;
        case "Award": return <Award className={className} />;
        case "HeartPulse": return <HeartPulse className={className} />;
        case "Activity": return <Activity className={className} />;
        case "Zap": return <Zap className={className} />;
        case "Building2": return <Building2 className={className} />;
        case "Heart": return <Heart className={className} />;
        default: return <CheckCircle2 className={className} />;
    }
}

export default function PublicSitePage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [site, setSite] = useState<GeneratedSite | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Interactive quick WhatsApp message box state
    const [visitorName, setVisitorName] = useState("");
    const [visitorMessage, setVisitorMessage] = useState("");

    useEffect(() => {
        if (!slug) return;
        fetch(`/api/sites/${slug}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.status && data.data?.site) {
                    setSite(data.data.site);
                    // Dynamically set page title
                    if (typeof document !== "undefined") {
                        document.title = `${data.data.site.businessName} - Official Website`;
                    }
                } else {
                    setError(data.message || "Website not found");
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load website");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-4" />
                <p className="text-sm font-medium tracking-wide text-slate-400">Loading website preview...</p>
            </div>
        );
    }

    if (error || !site) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                    <AlertCircle className="h-12 w-12 text-rose-400 mx-auto" />
                    <h2 className="text-lg font-bold">Website Not Found</h2>
                    <p className="text-xs text-slate-400">
                        {error || "The website you are looking for does not exist or may have been updated."}
                    </p>
                </div>
            </div>
        );
    }

    const theme = THEME_CONFIGS[site.themeColor] || THEME_CONFIGS.emerald;
    const phoneClean = site.whatsappPhone.replace(/\D/g, "");
    const waBaseUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(site.whatsappGreeting)}`;
    const telUrl = `tel:${site.phone}`;

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const text = `Hello ${site.businessName},\nMy Name: ${visitorName || "Guest"}\nMessage: ${visitorMessage || "I would like to inquire about your services."}`;
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-20 md:pb-0">
            {/* Top Info Bar */}
            <div className="bg-slate-900/90 border-b border-slate-800 text-[11px] py-1.5 px-4 text-slate-400">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{site.address || (site.city ? `${site.city}, India` : "Verified Local Business")}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1 text-slate-300">
                            <Clock className="h-3 w-3 text-emerald-400" />
                            <span>Mon - Sat: 9am - 8pm</span>
                        </span>
                        <a
                            href={telUrl}
                            className="hidden sm:flex items-center gap-1 text-emerald-400 hover:underline font-mono"
                        >
                            <Phone className="h-3 w-3" />
                            <span>{site.phone}</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Navigation Header */}
            <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 text-sm">
                            {site.businessName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="font-bold text-sm sm:text-base leading-tight tracking-tight text-white line-clamp-1">
                                {site.businessName}
                            </h1>
                            <p className="text-[10px] text-emerald-400 font-medium">
                                {site.category}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={telUrl}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors"
                        >
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>Call</span>
                        </a>
                        <a
                            href={waBaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                        </a>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden py-12 sm:py-20 px-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-transparent to-transparent pointer-events-none" />
                <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5">
                    {/* Badge Pill */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Verified {site.category} {site.city ? `• ${site.city}` : ""}</span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
                        {site.headline}
                    </h2>

                    {/* Subheadline */}
                    <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        {site.subheadline}
                    </p>

                    {/* Trust Proof Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-1 text-xs text-slate-300">
                        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
                            <div className="flex text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="h-3 w-3 fill-amber-400" />
                                ))}
                            </div>
                            <span className="font-semibold text-white ml-1">4.9</span>
                            <span className="text-slate-400">({site.stats.reviewsCount}+ Reviews)</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>100% Certified Care</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            <span>Instant WhatsApp Booking</span>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                        <a
                            href={waBaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span>Book Consultation on WhatsApp</span>
                        </a>
                        <a
                            href={telUrl}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                        >
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span>Call {site.phone}</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* About Us Section */}
            <section className="py-12 px-4 max-w-5xl mx-auto">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>About Our Business</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                            {site.about.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            {site.about.description}
                        </p>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800/60 rounded-xl p-5 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Key Commitments
                        </h4>
                        <div className="space-y-2.5">
                            {site.about.highlights.map((highlight, idx) => (
                                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{highlight}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section className="py-12 px-4 max-w-5xl mx-auto">
                <div className="text-center max-w-2xl mx-auto space-y-2 mb-8">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        <Award className="h-3.5 w-3.5" />
                        <span>Our Specialized Offerings</span>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-extrabold text-white">
                        Services Tailored for You
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                        High quality, safe, and professional solutions handled by seasoned experts.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {site.services.map((service: SiteService) => (
                        <div
                            key={service.id}
                            className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-5 space-y-3 transition-all hover:translate-y-[-2px] group"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {renderIcon(service.icon, "h-5 w-5")}
                                </div>
                                {service.tag && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {service.tag}
                                    </span>
                                )}
                            </div>
                            <h4 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                                {service.title}
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {service.description}
                            </p>
                            <a
                                href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hello ${site.businessName}, I would like to inquire about "${service.title}". Please provide details.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold pt-1"
                            >
                                <span>Inquire on WhatsApp</span>
                                <ChevronRight className="h-3 w-3" />
                            </a>
                        </div>
                    ))}
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="py-12 px-4 max-w-5xl mx-auto">
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
                    <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
                        <h3 className="text-xl sm:text-2xl font-bold text-white">
                            Why Choose {site.businessName}
                        </h3>
                        <p className="text-xs text-slate-400">
                            Setting the standard for quality, transparency, and client satisfaction.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {site.features.map((feat) => (
                            <div key={feat.id} className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl text-center space-y-2">
                                <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                                    {renderIcon(feat.icon, "h-4 w-4")}
                                </div>
                                <h4 className="font-semibold text-xs text-white">{feat.title}</h4>
                                <p className="text-[11px] text-slate-400 leading-normal">{feat.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-12 px-4 max-w-5xl mx-auto">
                <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
                    <div className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span>Client Experiences</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                        Loved by Customers
                    </h3>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                    {site.testimonials.map((t) => (
                        <div key={t.id} className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-xl space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className="flex text-amber-400">
                                    {[...Array(t.rating || 5)].map((_, i) => (
                                        <Star key={i} className="h-3 w-3 fill-amber-400" />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-300 italic leading-relaxed">
                                    &ldquo;{t.comment}&rdquo;
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center">
                                    {t.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-white">{t.name}</div>
                                    <div className="text-[10px] text-slate-500">{t.role || "Verified Client"}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Contact & Working Hours + WhatsApp Message Form */}
            <section className="py-12 px-4 max-w-5xl mx-auto">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Location & Hours Card */}
                    <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl space-y-5">
                        <h3 className="text-lg font-bold text-white">Visit Our Location & Timings</h3>
                        
                        <div className="space-y-4 text-xs">
                            <div className="flex items-start gap-3 text-slate-300">
                                <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-white block">Address:</span>
                                    <span>{site.address || `${site.businessName}, ${site.city || "India"}`}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 text-slate-300">
                                <Clock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-white block">Working Hours:</span>
                                    <div className="space-y-0.5 text-slate-400">
                                        <div>Monday – Saturday: <span className="text-slate-200">{site.workingHours?.weekdays || "9:00 AM - 8:00 PM"}</span></div>
                                        <div>Sunday: <span className="text-slate-200">{site.workingHours?.weekends || "10:00 AM - 6:00 PM"}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 text-slate-300">
                                <Phone className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-white block">Phone / WhatsApp:</span>
                                    <a href={telUrl} className="text-emerald-400 hover:underline font-mono">
                                        {site.phone}
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <a
                                href={waBaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>Get Directions & Connect on WhatsApp</span>
                            </a>
                        </div>
                    </div>

                    {/* Quick Inquiry Form */}
                    <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl space-y-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">Send Direct Inquiry</h3>
                            <p className="text-xs text-slate-400">
                                Have questions? Send a direct message to our WhatsApp team for an instant response.
                            </p>
                        </div>

                        <form onSubmit={handleSendMessage} className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-medium text-slate-400 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter your name"
                                    value={visitorName}
                                    onChange={(e) => setVisitorName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-medium text-slate-400 mb-1">Your Question / Requirement</label>
                                <textarea
                                    rows={3}
                                    placeholder="e.g. I would like to know treatment pricing / book an appointment..."
                                    value={visitorMessage}
                                    onChange={(e) => setVisitorMessage(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                            >
                                <Send className="h-3.5 w-3.5" />
                                <span>Send on WhatsApp</span>
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p>© {new Date().getFullYear()} {site.businessName}. All rights reserved.</p>
                    <p className="text-[11px] flex items-center justify-center gap-1 text-slate-600">
                        <span>Powered by</span>
                        <span className="text-emerald-500 font-semibold">Enterprise WhatsApp Gateway</span>
                    </p>
                </div>
            </footer>

            {/* Sticky Mobile Floating Action Bar (Mobile Only) */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-2.5 px-4 flex items-center gap-2">
                <a
                    href={telUrl}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-white shadow-sm"
                >
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>Call Now</span>
                </a>
                <a
                    href={waBaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/30"
                >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                </a>
            </div>
        </div>
    );
}
