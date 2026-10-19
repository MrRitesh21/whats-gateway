"use client";

import { SessionProvider } from "next-auth/react";
import { TranslateSafeBoundary } from "@/components/error-boundary";
import { PWAProvider } from "@/components/pwa/pwa-provider";
import { PWAInstallModal } from "@/components/pwa/pwa-install-modal";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TranslateSafeBoundary>
        <PWAProvider>
          {children}
          <PWAInstallModal />
        </PWAProvider>
      </TranslateSafeBoundary>
    </SessionProvider>
  );
}
