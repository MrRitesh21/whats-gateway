"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
    isCollapsed: boolean;
    toggleCollapse: () => void;
    toggleSidebar: () => void;
    setCollapsed: (collapsed: boolean) => void;
    isMobileNavOpen: boolean;
    setMobileNavOpen: (open: boolean) => void;
    toggleMobileNav: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    // Persist sidebar state in localStorage
    useEffect(() => {
        const saved = localStorage.getItem("sidebar_collapsed");
        if (saved !== null) {
            setIsCollapsed(saved === "true");
        }
    }, []);

    const toggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem("sidebar_collapsed", String(next));
            return next;
        });
    };

    const setCollapsed = (collapsed: boolean) => {
        setIsCollapsed(collapsed);
        localStorage.setItem("sidebar_collapsed", String(collapsed));
    };

    const toggleMobileNav = () => {
        setIsMobileNavOpen(prev => !prev);
    };

    return (
        <SidebarContext.Provider value={{
            isCollapsed,
            toggleCollapse,
            toggleSidebar: toggleCollapse,
            setCollapsed,
            isMobileNavOpen,
            setMobileNavOpen: setIsMobileNavOpen,
            toggleMobileNav,
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
