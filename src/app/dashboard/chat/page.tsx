import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";
import { cookies } from "next/headers";
import { canAccessSession } from "@/lib/api-auth";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { Suspense } from "react";

export default async function ChatPage(props: {
    searchParams?: Promise<{ phone?: string; jid?: string; name?: string }>;
}) {
    const session = await auth();

    if (!session?.user?.id) return <div>Unauthorized</div>;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    let validSessionId: string | null = null;

    if (sessionId) {
        // Validate access
        const hasAccess = await canAccessSession(session.user.id, session.user.role, sessionId);
        if (hasAccess) {
            // Ideally also check if CONNECTED but canAccessSession checks ownership.
            // We can do an extra check if needed.
            validSessionId = sessionId;
        }
    }

    if (!validSessionId) {
        return (
            <SessionGuard>
                <ChatInterface sessionId={null} />
            </SessionGuard>
        );
    }

    const sp = props.searchParams ? await props.searchParams : {};

    return (
        <div className="h-[calc(100dvh-6.5rem)] sm:h-[calc(100dvh-6rem)]">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chat...</div>}>
                <ChatLayoutClient
                    key={validSessionId}
                    sessionId={validSessionId}
                    initialPhone={sp.phone || null}
                    initialJid={sp.jid || null}
                    initialName={sp.name || null}
                />
            </Suspense>
        </div>
    );
}
