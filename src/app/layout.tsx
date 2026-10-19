import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { TopLoader } from "@/components/ui/top-loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3030"),
  title: "WAFlow WhatsApp | WhatsApp Gateway & Automation",
  description: "Next-generation WhatsApp Gateway & Automation by WAFlow WhatsApp",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WAFlow",
  },
  applicationName: "WAFlow WhatsApp",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
    follow: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  interactiveWidget: "resizes-content" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning data-scroll-behavior="smooth" className="scroll-smooth notranslate">
      <head>
        {/* PWA primary meta tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WAFlow" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Disable browser translators */}
        <meta name="google" content="notranslate" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased text-foreground bg-background selection:bg-primary/30 selection:text-primary-foreground min-h-screen flex flex-col notranslate`}
        suppressHydrationWarning
      >
        {/* Belt-and-suspenders DOM patch: even if a translator bypasses
            the meta tags above (some extensions ignore them), we make
            DOM mutations fail-soft so React keeps rendering. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof Node==='undefined')return;var p=Node.prototype;if(!p.__translateFixApplied){p.__translateFixApplied=true;var origRemove=p.removeChild;p.removeChild=function(child){if(child.parentNode!==this)return child;return origRemove.apply(this,arguments);};var origInsert=p.insertBefore;p.insertBefore=function(newNode,refNode){if(refNode&&refNode.parentNode!==this)return origInsert.call(this,newNode,null);return origInsert.apply(this,arguments);};var origReplace=p.replaceChild;p.replaceChild=function(newNode,oldNode){if(oldNode&&oldNode.parentNode!==this)return oldNode;return origReplace.apply(this,arguments);};}if(typeof window!=='undefined'&&!window.__extErrorGuardApplied){window.__extErrorGuardApplied=true;window.addEventListener('unhandledrejection',function(e){try{var r=e&&e.reason;var msg=String((r&&(r.message||r.stack||r))||'');if(msg.includes('tabs:outgoing.message.ready')||msg.includes('No Listener:')||msg.includes('in app messages from Iterable')||msg.includes('Floto')||msg.includes('Grammarly')){e.preventDefault();e.stopImmediatePropagation();}}catch(_){}});}})();`,
          }}
        />
        {/* Global ambient background glow for premium feel */}
        <div className="fixed inset-0 -z-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background dark:from-primary/10 dark:via-background dark:to-background pointer-events-none" />
        <Providers>
          <TopLoader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
