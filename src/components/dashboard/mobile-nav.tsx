"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Download } from "lucide-react";
import { usePWAInstall } from "@/components/pwa/pwa-provider";
import { useSidebar } from "./sidebar-context";
import Link from "next/link";
import {
    Gauge,
    Scan,
    Inbox,
    Zap,
    Sparkles,
    BookUser,
    Network,
    Bookmark,
    Cpu,
    BotMessageSquare,
    BadgeCheck,
    Timer,
    Radar,
    GitFork,
    Cable,
    BookOpen,
    Braces,
    Wallet,
    FolderArchive,
    Key,
    ShieldCheck,
    SlidersHorizontal,
    BarChart3,
    BellDot,
    LogOut,
    Users,
    FileText,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import pkg from "../../../package.json";

interface NavGroup {
    label: string;
    items: { href: string; label: string; icon: React.ElementType; external?: boolean; superadminOnly?: boolean; capability?: string }[];
}

// Keep in sync with sidebar-nav.tsx
const navGroups: NavGroup[] = [
    {
        label: "Main",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: Gauge },
            { href: "/dashboard/sessions", label: "Sessions / QR", icon: Scan },
        ],
    },
    {
        label: "Messaging",
        items: [
            { href: "/dashboard/chat", label: "Chat", icon: Inbox, capability: "chat" },
            { href: "/dashboard/bulk-messenger", label: "Bulk Messenger", icon: Zap, capability: "bulkMessenger" },
            { href: "/dashboard/broadcast", label: "Broadcast", icon: Zap, capability: "broadcast" },
            { href: "/dashboard/sticker", label: "Sticker Maker", icon: Sparkles, capability: "sticker" },
        ],
    },
    {
        label: "Contacts & CRM",
        items: [
            { href: "/dashboard/crm", label: "CRM & Leads", icon: Users, capability: "crm" },
            { href: "/dashboard/lead-forms", label: "Lead Forms & Outreach", icon: FileText, capability: "leadForms" },
            { href: "/dashboard/contacts", label: "Contacts", icon: BookUser, capability: "contacts" },
            { href: "/dashboard/groups", label: "Groups", icon: Network, capability: "groups" },
            { href: "/dashboard/labels", label: "Labels", icon: Bookmark, capability: "labels" },
        ],
    },
    {
        label: "Automation",
        items: [
            { href: "/dashboard/ai-gateway", label: "Smart AI & RAG", icon: Sparkles, capability: "smartAi" },
            { href: "/dashboard/bot-settings", label: "Bot Settings", icon: Cpu, capability: "botSettings" },
            { href: "/dashboard/autoreply", label: "Auto Reply", icon: BotMessageSquare, capability: "autoReply" },
            { href: "/dashboard/profile", label: "Bot Profile", icon: BadgeCheck, capability: "botProfile" },
            { href: "/dashboard/scheduler", label: "Scheduler", icon: Timer, capability: "scheduler" },
            { href: "/dashboard/auto-broadcast", label: "Auto Broadcast", icon: Radar, capability: "autoBroadcast" },
            { href: "/dashboard/jpm-swgc", label: "JPM SWGC", icon: GitFork, capability: "jpm" },
            { href: "/dashboard/webhooks", label: "Webhooks & API", icon: Cable, capability: "webhook" },
        ],
    },
    {
        label: "Developer",
        items: [
            { href: "/dashboard/mcp", label: "MCP & Claude AI", icon: Sparkles, capability: "mcp" },
            { href: "/docs", label: "API Docs", icon: BookOpen, capability: "apiDocs" },
            { href: "/swagger", label: "Swagger UI", icon: Braces, external: true, capability: "apiDocs" },
        ],
    },
    {
        label: "Account",
        items: [
            { href: "/dashboard/billing", label: "Billing & Plan", icon: Wallet },
        ],
    },
    {
        label: "Administration",
        items: [
            { href: "/dashboard/media", label: "Media Manager", icon: FolderArchive, capability: "mediaManager" },
            { href: "/dashboard/sessions/access", label: "Session Access", icon: Key },
            { href: "/dashboard/users", label: "Users", icon: ShieldCheck, superadminOnly: true },
            { href: "/dashboard/settings", label: "Settings", icon: SlidersHorizontal },
            { href: "/dashboard/system-monitor", label: "System Monitor", icon: BarChart3, superadminOnly: true },
            { href: "/dashboard/notifications", label: "Notifications", icon: BellDot, superadminOnly: true },
        ],
    },
];

export function MobileNav({ appName = "WAFlow WhatsApp" }: { appName?: string }) {
    const { isMobileNavOpen, setMobileNavOpen } = useSidebar();
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isInstalled, installApp } = usePWAInstall();
    // @ts-ignore
    const userRole = session?.user?.role;

    const [caps, setCaps] = useState<Record<string, boolean> | null>(null);
    useEffect(() => {
        let active = true;
        fetch("/api/usage")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (active && d?.data?.capabilities) setCaps(d.data.capabilities);
            })
            .catch(() => { });
        return () => {
            active = false;
        };
    }, []);

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[320px] p-0 flex flex-col">
                <SheetHeader className="px-5 py-4 text-left border-b border-slate-100">
                    <SheetTitle className="text-xl font-bold text-slate-800" translate="no">{appName}</SheetTitle>
                    <SheetDescription className="text-[11px] text-slate-400 -mt-1">WhatsApp Gateway</SheetDescription>
                </SheetHeader>

                <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
                    {navGroups.map((group) => {
                        const visibleItems = group.items.filter(
                            (item) =>
                                (!item.superadminOnly || userRole === "SUPERADMIN") &&
                                !(item.capability && caps && caps[item.capability] === false)
                        );
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={group.label} className="mb-1">
                                {group.label !== "Main" && (
                                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        {group.label}
                                    </p>
                                )}
                                <div className="space-y-0.5">
                                    {visibleItems.map(({ href, label, icon: Icon, external }) => (
                                        <Link
                                            key={href}
                                            href={href}
                                            target={external ? "_blank" : undefined}
                                            onClick={() => setMobileNavOpen(false)}
                                            className={`
                                                flex items-center rounded-lg text-sm font-medium
                                                transition-all duration-200 group relative
                                                gap-3 px-3 py-2
                                                ${isActive(href)
                                                    ? "text-primary bg-primary/10 shadow-sm"
                                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                }
                                            `}
                                        >
                                            {isActive(href) && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
                                            )}
                                            <div className={`
                                                flex items-center justify-center rounded-md p-1.5 transition-all duration-200
                                                ${isActive(href)
                                                    ? "bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30"
                                                    : "text-muted-foreground/80 group-hover:text-primary group-hover:bg-primary/10"
                                                }
                                            `}>
                                                <Icon
                                                    size={16}
                                                    className="flex-shrink-0"
                                                />
                                            </div>
                                            <span className="truncate">{label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                            {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate" translate="no">{session?.user?.name || "User"}</p>
                            <p className="text-[11px] text-slate-400 truncate" translate="no">{session?.user?.email}</p>
                        </div>
                    </div>
                    {!isInstalled && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2 text-xs h-8 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => {
                                setMobileNavOpen(false);
                                installApp();
                            }}
                        >
                            <Download className="h-3.5 w-3.5 text-emerald-500" />
                            Install App (1-Click)
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2 text-xs h-8"
                        onClick={async () => {
                            setMobileNavOpen(false);
                            try {
                                await signOut({ redirect: false });
                            } catch { }
                            document.cookie.split(";").forEach((c) => {
                                const eqPos = c.indexOf("=");
                                const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
                                if (name.includes("auth") || name.includes("session")) {
                                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                                }
                            });
                            window.location.replace("/auth/login");
                        }}
                    >
                        <LogOut size={14} /> Sign Out
                    </Button>
                    <p className="text-[10px] text-slate-300 text-center mt-2 font-mono" translate="no">v{pkg.version}</p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
