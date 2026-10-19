"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, QrCode, Send, MoreHorizontal } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

interface NavTabItem {
    href: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
    isCenterAction?: boolean;
}

const TAB_ITEMS: NavTabItem[] = [
    {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        exact: true,
    },
    {
        href: "/dashboard/chat",
        label: "Chats",
        icon: MessageSquare,
    },
    {
        href: "/dashboard/sessions",
        label: "Sessions",
        icon: QrCode,
        isCenterAction: true,
    },
    {
        href: "/dashboard/bulk-messenger",
        label: "Broadcast",
        icon: Send,
    },
];

export function BottomNav() {
    const pathname = usePathname();
    const { isMobileNavOpen, setMobileNavOpen } = useSidebar();

    const triggerHaptic = () => {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
            try {
                navigator.vibrate(8);
            } catch {}
        }
    };

    const isTabActive = (item: NavTabItem) => {
        if (item.exact) {
            return pathname === item.href;
        }
        return pathname.startsWith(item.href);
    };

    return (
        <nav
            aria-label="Mobile Bottom Navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 dark:bg-card/90 backdrop-blur-2xl border-t border-border/60 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.45)] pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5 px-2 transition-all duration-300"
        >
            <div className="max-w-md mx-auto grid grid-cols-5 items-center justify-items-center">
                {TAB_ITEMS.map((item) => {
                    const active = isTabActive(item);
                    const Icon = item.icon;

                    if (item.isCenterAction) {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={triggerHaptic}
                                className="flex flex-col items-center justify-center -mt-3.5 group focus:outline-none"
                            >
                                <div
                                    className={cn(
                                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg",
                                        active
                                            ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/30 scale-105 ring-2 ring-emerald-500/40"
                                            : "bg-card border border-border/80 text-foreground/80 hover:text-emerald-500 shadow-black/10 active:scale-95"
                                    )}
                                >
                                    <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                                </div>
                                <span
                                    className={cn(
                                        "text-[10px] tracking-tight mt-1 font-medium transition-colors",
                                        active ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={triggerHaptic}
                            className="flex flex-col items-center justify-center py-1 px-1.5 w-full group relative focus:outline-none"
                        >
                            <div
                                className={cn(
                                    "relative p-1.5 rounded-xl transition-all duration-200",
                                    active
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 scale-105"
                                        : "text-muted-foreground group-hover:text-foreground active:scale-95"
                                )}
                            >
                                <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                                {active && (
                                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-3.5 bg-emerald-500 rounded-full animate-in fade-in zoom-in-75 duration-200" />
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-[10px] tracking-tight mt-0.5 transition-colors text-center truncate max-w-full",
                                    active ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground font-medium"
                                )}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* 5th Tab: More (Drawer Trigger) */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic();
                        setMobileNavOpen(!isMobileNavOpen);
                    }}
                    aria-label="Open full menu"
                    aria-expanded={isMobileNavOpen}
                    className="flex flex-col items-center justify-center py-1 px-1.5 w-full group relative focus:outline-none"
                >
                    <div
                        className={cn(
                            "relative p-1.5 rounded-xl transition-all duration-200",
                            isMobileNavOpen
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 scale-105"
                                : "text-muted-foreground group-hover:text-foreground active:scale-95"
                        )}
                    >
                        <MoreHorizontal className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                        {isMobileNavOpen && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-3.5 bg-emerald-500 rounded-full animate-in fade-in zoom-in-75 duration-200" />
                        )}
                    </div>
                    <span
                        className={cn(
                            "text-[10px] tracking-tight mt-0.5 transition-colors text-center truncate max-w-full",
                            isMobileNavOpen ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground font-medium"
                        )}
                    >
                        More
                    </span>
                </button>
            </div>
        </nav>
    );
}
