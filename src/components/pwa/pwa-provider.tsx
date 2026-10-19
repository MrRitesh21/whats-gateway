"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextType {
    isInstallable: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    installApp: () => Promise<void>;
    showIOSPrompt: boolean;
    setShowIOSPrompt: (show: boolean) => void;
}

const PWAContext = createContext<PWAContextType>({
    isInstallable: false,
    isInstalled: false,
    isIOS: false,
    installApp: async () => {},
    showIOSPrompt: false,
    setShowIOSPrompt: () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSPrompt, setShowIOSPrompt] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (already installed)
        const checkIsInstalled = () => {
            const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes("android-app://");
            setIsInstalled(isStandalone);
        };

        checkIsInstalled();

        // Detect iOS devices (Safari does not support beforeinstallprompt)
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
        setIsIOS(isAppleDevice);

        // Register Service Worker in production / supported environments
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker
                    .register("/sw.js")
                    .then((reg) => {
                        console.log("[PWA] Service Worker registered with scope:", reg.scope);
                    })
                    .catch((err) => {
                        console.warn("[PWA] Service Worker registration failed:", err);
                    });
            });
        }

        // Capture the native beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
            console.log("[PWA] captured beforeinstallprompt event");
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
            toast.success("WAFlow App installed successfully!");
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('gesturestart', handleGesture);
            document.removeEventListener('gesturechange', handleGesture);
            document.removeEventListener('gestureend', handleGesture);
            document.removeEventListener('touchend', handleTouchEnd);
            };
    }, []);

    const installApp = async () => {
        if (isInstalled) {
            toast.info("WAFlow is already installed on your device.");
            return;
        }

        if (deferredPrompt) {
            // Native 1-Click Install Prompt
            try {
                await deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === "accepted") {
                    toast.success("Installing WAFlow App...");
                    setIsInstalled(true);
                    setIsInstallable(false);
                    setDeferredPrompt(null);
                } else {
                    toast.info("Installation dismissed");
                }
            } catch (err) {
                console.error("[PWA] Install prompt error:", err);
            }
        } else if (isIOS) {
            // Open iOS instructions modal
            setShowIOSPrompt(true);
        } else {
            toast.info("To install WAFlow, click your browser menu (⋮ or ⊕) and select 'Install WAFlow WhatsApp'.");
        }
    };

    return (
        <PWAContext.Provider
            value={{
                isInstallable,
                isInstalled,
                isIOS,
                installApp,
                showIOSPrompt,
                setShowIOSPrompt,
            }}
        >
            {children}
        </PWAContext.Provider>
    );
}

export function usePWAInstall() {
    return useContext(PWAContext);
}
