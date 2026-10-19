"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
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
    Users,
    FileText
} from "lucide-react";
import { useSidebar } from "./sidebar-context";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavGroup {
    label: string;
    items: NavItem[];
}

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    external?: boolean;
    superadminOnly?: boolean;
    allowedRoles?: string[];
    capability?: string;
}

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

export function SidebarNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { isCollapsed, toggleCollapse } = useSidebar();
    // @ts-ignore
    const userRole = session?.user?.role;

    // Kapabilitas plan user (untuk sembunyikan menu fitur yang tidak aktif di plannya).
    const [caps, setCaps] = useState<Record<string, boolean> | null>(null);
    useEffect(() => {
        let active = true;
        fetch("/api/usage")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (active && d?.data?.capabilities) setCaps(d.data.capabilities);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    // Track collapsed groups — all expanded by default
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const isActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard";
        return pathname.startsWith(href);
    };

    return (
        <TooltipProvider delayDuration={0}>
            <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5 styled-scrollbar">
                {navGroups.map((group) => {
                    const visibleItems = group.items.filter((item) => {
                        if (item.superadminOnly && userRole !== "SUPERADMIN") return false;
                        if (item.allowedRoles && (!userRole || !item.allowedRoles.includes(userRole))) return false;
                        // Sembunyikan fitur yang dimatikan di plan user (SUPERADMIN: /api/usage balikin semua true).
                        if (item.capability && caps && caps[item.capability] === false) return false;
                        return true;
                    });
                    if (visibleItems.length === 0) return null;

                    const isGroupCollapsed = collapsedGroups[group.label] ?? false;

                    // "Main" group doesn't show a collapsible header
                    if (group.label === "Main") {
                        return (
                            <div key={group.label} className="mb-1">
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.href}
                                        item={item}
                                        active={isActive(item.href)}
                                        isCollapsed={isCollapsed}
                                    />
                                ))}
                            </div>
                        );
                    }

                    return (
                        <div key={group.label} className="mb-1">
                            {/* Group header — hidden when sidebar collapsed */}
                            {!isCollapsed && (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground/80 transition-colors group"
                                >
                                    {group.label}
                                    <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 ${isGroupCollapsed ? "-rotate-90" : ""}`}
                                    />
                                </button>
                            )}

                            {/* Collapsed sidebar: show a thin divider between groups */}
                            {isCollapsed && (
                                <div className="mx-3 my-2 border-t border-border/30" />
                            )}

                            {(!isGroupCollapsed || isCollapsed) && (
                                <div className="space-y-0.5">
                                    {visibleItems.map((item) => (
                                        <NavLink
                                            key={item.href}
                                            item={item}
                                            active={isActive(item.href)}
                                            isCollapsed={isCollapsed}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Collapse Toggle Button */}
            <div className="px-2 py-2 border-t border-border/30">
                <button
                    onClick={toggleCollapse}
                    className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                >
                    {isCollapsed ? (
                        <PanelLeft size={18} />
                    ) : (
                        <>
                            <PanelLeftClose size={16} />
                            <span>Collapse</span>
                        </>
                    )}
                </button>
            </div>
        </TooltipProvider>
    );
}

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed: boolean }) {
    const Icon = item.icon;

    const linkContent = (
        <Link
            href={item.href}
            target={item.external ? "_blank" : undefined}
            className={`
                flex items-center rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${isCollapsed ? "justify-center px-2 py-2.5 mx-1" : "gap-3 px-3 py-2"}
                ${active
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }
            `}
        >
            {active && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full" />
            )}
            <div className={`
                flex items-center justify-center rounded-md p-1.5 transition-all duration-200
                ${active
                    ? "bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30"
                    : "text-muted-foreground/80 group-hover:text-primary group-hover:bg-primary/10"
                }
            `}>
                <Icon
                    size={isCollapsed ? 18 : 16}
                    className="flex-shrink-0"
                />
            </div>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                    <p className="text-xs font-medium">{item.label}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return linkContent;
}
