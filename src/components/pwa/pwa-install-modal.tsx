"use client";

import React from "react";
import { usePWAInstall } from "./pwa-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share, PlusSquare, Smartphone, CheckCircle2 } from "lucide-react";

interface PWAInstallButtonProps {
    variant?: "default" | "outline" | "ghost" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    showText?: boolean;
}

export function PWAInstallButton({
    variant = "outline",
    size = "sm",
    className = "",
    showText = true,
}: PWAInstallButtonProps) {
    const { isInstalled, installApp, isInstallable, isIOS } = usePWAInstall();

    // Don't show if already running inside installed standalone app
    if (isInstalled) {
        return null;
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={installApp}
            className={`relative group border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium transition-all duration-200 shrink-0 ${className}`}
            title="Install WAFlow Native App"
        >
            <Download className="h-4 w-4 mr-1.5 transition-transform group-hover:-translate-y-0.5" />
            {showText && <span>Install App</span>}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
        </Button>
    );
}

export function PWAInstallModal() {
    const { showIOSPrompt, setShowIOSPrompt } = usePWAInstall();

    return (
        <Dialog open={showIOSPrompt} onOpenChange={setShowIOSPrompt}>
            <DialogContent className="sm:max-w-md rounded-2xl border-emerald-500/20 shadow-2xl glass-panel">
                <DialogHeader className="text-center items-center pb-2">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2">
                        <Smartphone className="h-7 w-7" />
                    </div>
                    <DialogTitle className="text-xl font-bold">Install WAFlow on iOS</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Install WAFlow on your iPhone or iPad for instant one-tap access, notifications, and fullscreen experience.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 py-3">
                    <div className="flex items-start gap-3.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shrink-0 shadow-sm">
                            <Share className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-foreground">1. Tap the Share button</p>
                            <p className="text-xs text-muted-foreground">Located at the bottom of Safari (or top right on iPad)</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shrink-0 shadow-sm">
                            <PlusSquare className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-foreground">2. Select 'Add to Home Screen'</p>
                            <p className="text-xs text-muted-foreground">Scroll down the menu list and tap Add to Home Screen</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                        <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-primary shrink-0 shadow-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-foreground">3. Tap 'Add'</p>
                            <p className="text-xs text-muted-foreground">WAFlow will appear right on your home screen as a native application.</p>
                        </div>
                    </div>
                </div>

                <Button
                    onClick={() => setShowIOSPrompt(false)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                    Got it
                </Button>
            </DialogContent>
        </Dialog>
    );
}
