"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
    Users,
    Calendar,
    HelpCircle,
    ArrowRight,
    Home,
    Info,
    Layers,
    MessageCircle,
    Check,
} from "lucide-react";
import type { GeneratedSite, SiteService } from "@/lib/sites/types";
import { THEME_CONFIGS } from "@/lib/sites/presets";

type ActivePage = "home" | "about" | "services" | "reviews" | "contact";

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

    // 5-Page Multi-Page Navigation state
    const [activePage, setActivePage] = useState<ActivePage>("home");

    // Interactive Inbound Lead / Inquiry Form State
    const [visitorName, setVisitorName] = useState("");
    const [visitorPhone, setVisitorPhone] = useState("");
    const [visitorService, setVisitorService] = useState("");
    const [visitorMessage, setVisitorMessage] = useState("");

    useEffect(() => {
        if (!slug) return;
        fetch(`/api/sites/${slug}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.status && data.data?.site) {
                    setSite(data.data.site);
                    if (data.data.site.services?.[0]) {
                        setVisitorService(data.data.site.services[0].title);
                    }
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

    const navigateTo = (page: ActivePage) => {
        setActivePage(page);
        if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-800 p-4">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm font-semibold tracking-wide text-slate-500">Loading website preview...</p>
            </div>
        );
    }

    if (error || !site) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
                <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                    <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
                    <h2 className="text-xl font-bold text-slate-900">Website Not Found</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
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

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = `Hello ${site.businessName},\n*New Website Inquiry*\nName: ${visitorName || "Guest"}\nPhone: ${visitorPhone || "Not provided"}\nInterested In: ${visitorService || "General Inquiry"}\nMessage: ${visitorMessage || "Please contact me with more information."}`;
        window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`, "_blank");
    };

    const navItems: { id: ActivePage; label: string; icon: any }[] = [
        { id: "home", label: "Home", icon: Home },
        { id: "about", label: "About Us", icon: Info },
        { id: "services", label: "Services", icon: Layers },
        { id: "reviews", label: "Reviews", icon: Star },
        { id: "contact", label: "Contact Us", icon: Phone },
    ];

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-500 selection:text-white pb-20 md:pb-0">
            {/* Top Info Notification Bar */}
            <div className="bg-slate-100/90 border-b border-slate-200/80 text-[11px] py-2 px-4 text-slate-600">
                <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium">{site.address || (site.city ? `${site.city}, India` : "Verified Business")}</span>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                        <span className="hidden sm:flex items-center gap-1 text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Mon - Sat: 9:00 AM - 8:00 PM</span>
                        </span>
                        <a
                            href={telUrl}
                            className="flex items-center gap-1 font-semibold text-slate-800 hover:text-emerald-600 font-mono transition-colors"
                        >
                            <Phone className="h-3 w-3 text-emerald-600" />
                            <span>{site.phone}</span>
                        </a>
                    </div>
                </div>
            </div>

            {/* Navigation Header with 5 Page Tabs */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    {/* Brand Logo & Name */}
                    <button
                        type="button"
                        onClick={() => navigateTo("home")}
                        className="flex items-center gap-2.5 text-left group cursor-pointer"
                    >
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-600/20 text-base group-hover:scale-105 transition-transform">
                            {site.businessName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                                {site.businessName}
                            </h1>
                            <p className="text-[10px] text-emerald-700 font-semibold tracking-wide">
                                {site.category}
                            </p>
                        </div>
                    </button>

                    {/* Desktop 5-Page Navigation Tabs */}
                    <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                        {navItems.map((item) => {
                            const isCurrent = activePage === item.id;
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => navigateTo(item.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isCurrent
                                            ? "bg-white text-emerald-700 shadow-xs border border-slate-200/60"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                                    }`}
                                >
                                    <IconComponent className={`h-3.5 w-3.5 ${isCurrent ? "text-emerald-600" : "text-slate-400"}`} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Quick Call & WhatsApp Action Buttons */}
                    <div className="flex items-center gap-2">
                        <a
                            href={telUrl}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors shadow-xs"
                        >
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span>Call</span>
                        </a>
                        <a
                            href={waBaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>WhatsApp</span>
                        </a>
                    </div>
                </div>

                {/* Mobile Scrollable Page Navigation Bar */}
                <div className="md:hidden flex items-center gap-1 overflow-x-auto pt-2.5 pb-0.5 border-t border-slate-100 mt-2.5 styled-scrollbar">
                    {navItems.map((item) => {
                        const isCurrent = activePage === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => navigateTo(item.id)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                    isCurrent
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════════════════════
                PAGE 1: HOME PAGE
            ══════════════════════════════════════════════════════════════════════ */}
            {activePage === "home" && (
                <main className="space-y-12">
                    {/* Hero Section */}
                    <section className="relative overflow-hidden py-14 sm:py-20 px-4 bg-gradient-to-b from-emerald-50/70 via-teal-50/30 to-white border-b border-slate-100">
                        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
                            {/* Live Badge */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-white text-emerald-800 text-xs font-bold shadow-xs">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Verified {site.category} {site.city ? `• ${site.city}` : ""}</span>
                            </div>

                            {/* Headline */}
                            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                                {site.headline}
                            </h2>

                            {/* Subheadline */}
                            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
                                {site.subheadline}
                            </p>

                            {/* Trust Proof Pills */}
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-700 pt-1">
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs">
                                    <div className="flex text-amber-500">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="h-3 w-3 fill-amber-500" />
                                        ))}
                                    </div>
                                    <span className="font-extrabold text-slate-900">4.9 / 5</span>
                                    <span className="text-slate-500">({site.stats.reviewsCount}+ Reviews)</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs font-semibold text-slate-800">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>100% Certified Standards</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-xs font-semibold text-slate-800">
                                    <Zap className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Instant WhatsApp Booking</span>
                                </div>
                            </div>

                            {/* Call to Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                                <a
                                    href={waBaseUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    <span>Book Consultation on WhatsApp</span>
                                </a>
                                <a
                                    href={telUrl}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-xs transition-all hover:scale-105 active:scale-95"
                                >
                                    <Phone className="h-4 w-4 text-slate-600" />
                                    <span>Call {site.phone}</span>
                                </a>
                            </div>
                        </div>
                    </section>

                    {/* About Us Teaser Section */}
                    <section className="px-4 max-w-6xl mx-auto">
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-10 grid md:grid-cols-2 gap-8 items-center">
                            <div className="space-y-4">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/60 px-3 py-1 rounded-full">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span>About {site.businessName}</span>
                                </span>
                                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
                                    {site.about.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    {site.about.description}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigateTo("about")}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline pt-2 cursor-pointer"
                                >
                                    <span>Read Full Story &amp; Certifications</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Our Core Guarantees
                                </h4>
                                <div className="space-y-3">
                                    {site.about.highlights.map((h, i) => (
                                        <div key={i} className="flex items-start gap-3 text-xs font-semibold text-slate-800">
                                            <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <Check className="h-3.5 w-3.5" />
                                            </div>
                                            <span>{h}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Featured Services Preview Section */}
                    <section className="px-4 max-w-6xl mx-auto space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                            <div className="space-y-1.5">
                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                                    Specialized Solutions
                                </span>
                                <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                                    Popular Services
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigateTo("services")}
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline self-start sm:self-auto cursor-pointer"
                            >
                                <span>Explore All Services</span>
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {site.services.slice(0, 3).map((service: SiteService) => (
                                <div
                                    key={service.id}
                                    className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3.5 shadow-xs hover:shadow-md transition-all hover:translate-y-[-2px] group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {renderIcon(service.icon, "h-5 w-5")}
                                        </div>
                                        {service.tag && (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {service.tag}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                                        {service.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        {service.description}
                                    </p>
                                    <a
                                        href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hello ${site.businessName}, I would like to inquire about "${service.title}".`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 pt-1"
                                    >
                                        <span>Book Appointment</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Why Choose Us Section */}
                    <section className="px-4 max-w-6xl mx-auto">
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-8">
                            <div className="text-center max-w-xl mx-auto space-y-2">
                                <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                                    Why People Trust {site.businessName}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Setting the highest benchmark in quality, patient care, and honest guidance.
                                </p>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {site.features.map((feat) => (
                                    <div key={feat.id} className="bg-white border border-slate-200 rounded-2xl p-5 text-center space-y-2.5 shadow-xs">
                                        <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                                            {renderIcon(feat.icon, "h-5 w-5")}
                                        </div>
                                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">{feat.title}</h4>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">{feat.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Quick Testimonial Teaser */}
                    <section className="px-4 max-w-6xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-amber-500" /> Client Feedback
                                </span>
                                <h3 className="text-2xl font-black text-slate-900">What Our Clients Say</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigateTo("reviews")}
                                className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                            >
                                Read All Reviews →
                            </button>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4">
                            {site.testimonials.map((t) => (
                                <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                                    <div className="flex text-amber-500">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="h-3 w-3 fill-amber-500" />
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-600 italic leading-relaxed">
                                        &ldquo;{t.comment}&rdquo;
                                    </p>
                                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">{t.name}</span>
                                            <span className="text-[10px] text-slate-400">{t.role || "Verified Client"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PAGE 2: ABOUT US PAGE
            ══════════════════════════════════════════════════════════════════════ */}
            {activePage === "about" && (
                <main className="max-w-5xl mx-auto px-4 py-10 space-y-12">
                    <div className="text-center max-w-2xl mx-auto space-y-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <Info className="h-3.5 w-3.5" />
                            <span>About Our Business</span>
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                            Our Story, Values &amp; Heritage
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            Learn more about our dedicated team, our founding principles, and our unwavering commitment to {site.category}.
                        </p>
                    </div>

                    {/* Detailed Story Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-10 space-y-6">
                        <div className="space-y-3">
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                                {site.about.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                {site.about.description}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                Over the years, {site.businessName} has grown into a trusted destination for individuals and families {site.city ? `across ${site.city}` : ""}. We continuously invest in advanced diagnostic equipment, ongoing professional development, and rigorous safety protocols so you always receive best-in-class care.
                            </p>
                        </div>

                        {/* 4 Pillars of Excellence */}
                        <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <h4 className="font-bold text-xs text-slate-900">Uncompromising Hygiene</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">Multi-tier sterilization and hygienic protocols meeting international healthcare guidelines.</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Users className="h-4 w-4" />
                                </div>
                                <h4 className="font-bold text-xs text-slate-900">Patient-First Philosophy</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">Attentive consultations where we listen to your concerns and explain options transparently.</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                                <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                                    <Award className="h-4 w-4" />
                                </div>
                                <h4 className="font-bold text-xs text-slate-900">Board Certified Staff</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">Continuous clinical upskilling and verified credentials ensuring reliable expertise.</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <Zap className="h-4 w-4" />
                                </div>
                                <h4 className="font-bold text-xs text-slate-900">Modern Technology</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed">Digital imaging, modern instruments, and streamlined appointments via WhatsApp.</p>
                            </div>
                        </div>
                    </div>

                    {/* How We Work - Process Journey */}
                    <div className="space-y-6">
                        <div className="text-center space-y-1.5">
                            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Our 4-Step Patient Journey</h3>
                            <p className="text-xs text-slate-500">How we ensure a seamless and comfortable experience from start to finish.</p>
                        </div>

                        <div className="grid sm:grid-cols-4 gap-4">
                            {[
                                { step: "01", title: "Easy WhatsApp Booking", desc: "Share your preferred date and time on WhatsApp for instant slot confirmation." },
                                { step: "02", title: "Comprehensive Checkup", desc: "Detailed examination, diagnosis, and personalized consultation with specialists." },
                                { step: "03", title: "Tailored Procedure", desc: "Gentle, pain-free treatment delivered with modern equipment and precision." },
                                { step: "04", title: "Aftercare & Support", desc: "Ongoing follow-up instructions and WhatsApp support whenever you need advice." },
                            ].map((s) => (
                                <div key={s.step} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
                                    <span className="text-2xl font-black text-emerald-600 font-mono block">{s.step}</span>
                                    <h4 className="font-bold text-xs text-slate-900">{s.title}</h4>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contact CTA */}
                    <div className="text-center pt-4">
                        <button
                            type="button"
                            onClick={() => navigateTo("contact")}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer"
                        >
                            <Calendar className="h-4 w-4" />
                            <span>Schedule an Appointment Today</span>
                        </button>
                    </div>
                </main>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PAGE 3: SERVICES CATALOG PAGE
            ══════════════════════════════════════════════════════════════════════ */}
            {activePage === "services" && (
                <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
                    <div className="text-center max-w-2xl mx-auto space-y-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <Layers className="h-3.5 w-3.5" />
                            <span>Complete Treatment &amp; Services</span>
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                            Our Specialized Services
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            Explore our comprehensive list of clinical and professional services. Click on any service to directly book an appointment or inquire on WhatsApp.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {site.services.map((service: SiteService) => (
                            <div
                                key={service.id}
                                className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {renderIcon(service.icon, "h-6 w-6")}
                                        </div>
                                        {service.tag && (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {service.tag}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                                        {service.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        {service.description}
                                    </p>
                                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>Certified Specialist Consultation</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                            <span>Transparent Pricing &amp; No Hidden Fees</span>
                                        </div>
                                    </div>
                                </div>

                                <a
                                    href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hello ${site.businessName}, I would like to book an appointment for "${service.title}". Please share available slots.`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-xs font-bold transition-all"
                                >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>Inquire &amp; Book on WhatsApp</span>
                                </a>
                            </div>
                        ))}
                    </div>

                    {/* FAQ Quick Banner */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-emerald-600" />
                            <h3 className="font-bold text-base text-slate-900">Frequently Asked Questions</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                                <span className="font-bold text-slate-800 block">Do I need an advance appointment?</span>
                                <p className="text-slate-500">While walk-ins are accepted based on availability, we recommend a prior WhatsApp booking to skip queue waiting times.</p>
                            </div>
                            <div className="space-y-1">
                                <span className="font-bold text-slate-800 block">What are the payment options?</span>
                                <p className="text-slate-500">We accept UPI (GPay, PhonePe, Paytm), cash, debit/credit cards, and net banking.</p>
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PAGE 4: REVIEWS & TESTIMONIALS PAGE
            ══════════════════════════════════════════════════════════════════════ */}
            {activePage === "reviews" && (
                <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
                    <div className="text-center max-w-2xl mx-auto space-y-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            <span>Verified Client Reviews</span>
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                            Patient Stories &amp; Ratings
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            See what people in our local community have to say about their experience with {site.businessName}.
                        </p>
                    </div>

                    {/* Overall Rating Score Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 grid md:grid-cols-3 gap-6 items-center text-center md:text-left">
                        <div className="space-y-2 text-center md:border-r border-slate-200 md:pr-6">
                            <span className="text-5xl font-black text-slate-900 font-mono">4.9</span>
                            <div className="flex justify-center text-amber-500">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="h-5 w-5 fill-amber-500" />
                                ))}
                            </div>
                            <p className="text-xs text-slate-500">Overall rating based on {site.stats.reviewsCount}+ verified reviews</p>
                        </div>

                        <div className="space-y-2 md:col-span-2 text-xs">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold w-16 text-slate-700">5 Stars</span>
                                <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full w-[94%]" />
                                </div>
                                <span className="font-bold text-slate-700 w-10 text-right">94%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-semibold w-16 text-slate-700">4 Stars</span>
                                <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full w-[6%]" />
                                </div>
                                <span className="font-bold text-slate-700 w-10 text-right">6%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-semibold w-16 text-slate-700">3 Stars</span>
                                <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full w-[0%]" />
                                </div>
                                <span className="font-bold text-slate-700 w-10 text-right">0%</span>
                            </div>
                        </div>
                    </div>

                    {/* Reviews Grid */}
                    <div className="grid sm:grid-cols-2 gap-5">
                        {site.testimonials.map((t) => (
                            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <div className="flex text-amber-500">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className="h-3.5 w-3.5 fill-amber-500" />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">Verified Customer</span>
                                </div>
                                <p className="text-xs text-slate-600 italic leading-relaxed">
                                    &ldquo;{t.comment}&rdquo;
                                </p>
                                <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                                        {t.name.charAt(0)}
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">{t.name}</span>
                                        <span className="text-[10px] text-slate-400">{t.role || "Local Resident"}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Feedback Call to Action */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                        <h3 className="font-bold text-sm text-slate-900">Visited {site.businessName} recently?</h3>
                        <p className="text-xs text-slate-600 max-w-md mx-auto">
                            We value your feedback! Share your experience on WhatsApp to help us continue providing outstanding service.
                        </p>
                        <a
                            href={`https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hello ${site.businessName}, I would like to leave feedback regarding my recent visit.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Leave a Review on WhatsApp</span>
                        </a>
                    </div>
                </main>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PAGE 5: CONTACT US & LOCATION PAGE
            ══════════════════════════════════════════════════════════════════════ */}
            {activePage === "contact" && (
                <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
                    <div className="text-center max-w-2xl mx-auto space-y-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <Phone className="h-3.5 w-3.5" />
                            <span>Get in Touch</span>
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                            Contact Us &amp; Find Directions
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                            Have questions or want to schedule an appointment? Reach out to us through any of the channels below.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Address & Timings Card */}
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
                            <h3 className="font-bold text-lg text-slate-900">Clinic &amp; Office Details</h3>

                            <div className="space-y-5 text-xs">
                                <div className="flex items-start gap-3.5">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-900 block text-sm">Physical Address:</span>
                                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                                            {site.address || `${site.businessName}, ${site.city || "India"}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3.5">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-900 block text-sm">Working Hours:</span>
                                        <div className="text-slate-600 mt-1 space-y-1">
                                            <div className="flex justify-between gap-4">
                                                <span>Monday – Saturday:</span>
                                                <span className="font-bold text-slate-900">{site.workingHours?.weekdays || "9:00 AM - 8:00 PM"}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span>Sunday:</span>
                                                <span className="font-bold text-slate-900">{site.workingHours?.weekends || "10:00 AM - 6:00 PM"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3.5">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-900 block text-sm">Direct Hotline:</span>
                                        <a href={telUrl} className="text-emerald-700 font-mono font-bold text-sm hover:underline">
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
                                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    <span>Chat Directly on WhatsApp</span>
                                </a>
                            </div>
                        </div>

                        {/* Interactive Inbound Inquiry Form */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">Send an Inquiry</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Fill this quick form and our team will respond directly on your WhatsApp number.
                                </p>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Your Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Ramesh Kumar"
                                        value={visitorName}
                                        onChange={(e) => setVisitorName(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp Phone Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="e.g. +91 9876543210"
                                        value={visitorPhone}
                                        onChange={(e) => setVisitorPhone(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Interested In</label>
                                    <select
                                        value={visitorService}
                                        onChange={(e) => setVisitorService(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    >
                                        {site.services.map((s) => (
                                            <option key={s.id} value={s.title}>{s.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Message or Preferred Time</label>
                                    <textarea
                                        rows={3}
                                        placeholder="e.g. Would like an appointment this Saturday morning..."
                                        value={visitorMessage}
                                        onChange={(e) => setVisitorMessage(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                                >
                                    <Send className="h-4 w-4" />
                                    <span>Send Inquiry on WhatsApp</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            )}

            {/* Light Footer with 5 Page Navigation Links */}
            <footer className="border-t border-slate-200 bg-slate-50 py-10 px-4 mt-16 text-slate-600 text-xs">
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Col 1: Brand Info */}
                        <div className="space-y-3 md:col-span-2">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                                    {site.businessName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-extrabold text-base text-slate-900">{site.businessName}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                                {site.tagline}. Delivering excellence, compassionate patient service, and modern clinical expertise.
                            </p>
                        </div>

                        {/* Col 2: 5 Pages Navigation */}
                        <div className="space-y-2">
                            <span className="font-bold text-xs uppercase text-slate-900 tracking-wider">Quick Navigation</span>
                            <ul className="space-y-1.5 text-xs">
                                {navItems.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => navigateTo(item.id)}
                                            className="hover:text-emerald-700 transition-colors cursor-pointer"
                                        >
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Col 3: Direct Contact */}
                        <div className="space-y-2">
                            <span className="font-bold text-xs uppercase text-slate-900 tracking-wider">Connect Directly</span>
                            <p className="text-xs text-slate-500 font-mono">{site.phone}</p>
                            <p className="text-xs text-slate-500">{site.city ? `${site.city}, India` : "India"}</p>
                            <a
                                href={waBaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline pt-1"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>WhatsApp Helpline</span>
                            </a>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                        <p>© {new Date().getFullYear()} {site.businessName}. All rights reserved.</p>
                        <p className="flex items-center gap-1">
                            <span>Powered by</span>
                            <span className="text-emerald-700 font-bold">Enterprise Cloud Gateway</span>
                        </p>
                    </div>
                </div>
            </footer>

            {/* Sticky Mobile Floating Action Bar (Mobile Only) */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 px-4 flex items-center gap-2 shadow-lg">
                <a
                    href={telUrl}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 shadow-xs"
                >
                    <Phone className="h-3.5 w-3.5 text-slate-600" />
                    <span>Call Now</span>
                </a>
                <a
                    href={waBaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-md shadow-emerald-600/25"
                >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                </a>
            </div>
        </div>
    );
}
