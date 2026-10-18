"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { MessageCircle } from "lucide-react";

interface ChatLayoutClientProps {
    sessionId: string;
    initialPhone?: string | null;
    initialJid?: string | null;
    initialName?: string | null;
}

interface SelectedChat {
    jid: string;
    name?: string;
    profilePic?: string | null;
}

function resolveChat(jidParam?: string | null, phoneParam?: string | null, nameParam?: string | null): SelectedChat | null {
    let targetJid = jidParam ? (jidParam.endsWith("@c.us") ? jidParam.replace("@c.us", "@s.whatsapp.net") : jidParam) : "";
    if (!targetJid && phoneParam) {
        let digits = phoneParam.replace(/\D/g, "");
        if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
        if (digits.length === 10 && /^[6-9]/.test(digits)) digits = "91" + digits;
        if (digits) targetJid = `${digits}@s.whatsapp.net`;
    }
    if (!targetJid) return null;

    const displayName = nameParam || (phoneParam ? `+${phoneParam.replace(/\D/g, "")}` : targetJid.split("@")[0]);
    return { jid: targetJid, name: displayName, profilePic: null };
}

export function ChatLayoutClient({ sessionId, initialPhone, initialJid, initialName }: ChatLayoutClientProps) {
    const searchParams = useSearchParams();

    const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(() => {
        return resolveChat(initialJid, initialPhone, initialName);
    });
    const [profilePicMap, setProfilePicMap] = useState<Record<string, string>>({});

    // Sync when query params change via router.push(/dashboard/chat?phone=...)
    useEffect(() => {
        const urlJid = searchParams?.get("jid") || initialJid;
        const urlPhone = searchParams?.get("phone") || initialPhone;
        const urlName = searchParams?.get("name") || initialName;

        const resolved = resolveChat(urlJid, urlPhone, urlName);
        if (resolved) {
            setSelectedChat((prev) => {
                if (prev?.jid === resolved.jid) return prev;
                return {
                    ...resolved,
                    profilePic: profilePicMap[resolved.jid] || null,
                };
            });
        }
    }, [searchParams, initialJid, initialPhone, initialName, profilePicMap]);

    const handleSelectChat = (jid: string, name?: string, profilePic?: string | null) => {
        const effectivePic = profilePic || profilePicMap[jid] || null;
        setSelectedChat({ jid, name, profilePic: effectivePic });
    };

    const handleProfilePicLoaded = (jid: string, url: string) => {
        setProfilePicMap(prev => ({ ...prev, [jid]: url }));
        setSelectedChat(prev => (prev && prev.jid === jid ? { ...prev, profilePic: url } : prev));
    };

    const handleBack = () => {
        setSelectedChat(null);
    };

    return (
        <div className="flex h-full bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden relative">
            {/* Chat List Panel */}
            <div
                className={`
                    w-full md:w-80 lg:w-[340px] border-r border-border/30 h-full overflow-hidden flex-shrink-0
                    absolute md:static inset-0 z-20 bg-background
                    transition-transform duration-300 ease-in-out
                    ${selectedChat ? "-translate-x-full md:translate-x-0" : "translate-x-0"}
                `}
            >
                <ChatList
                    sessionId={sessionId}
                    onSelectChat={handleSelectChat}
                    selectedJid={selectedChat?.jid}
                    selectedChatName={selectedChat?.name}
                    externalProfilePics={profilePicMap}
                />
            </div>

            {/* Chat Window Panel */}
            <div
                className={`
                    flex-1 h-full overflow-hidden
                    absolute md:static inset-0 z-10 bg-background
                    transition-transform duration-300 ease-in-out
                    ${selectedChat ? "translate-x-0 z-30" : "translate-x-full md:translate-x-0"}
                `}
            >
                {selectedChat ? (
                    <ChatWindow
                        sessionId={sessionId}
                        jid={selectedChat.jid}
                        name={selectedChat.name}
                        profilePic={selectedChat.profilePic || profilePicMap[selectedChat.jid] || null}
                        onProfilePicLoaded={(url) => handleProfilePicLoaded(selectedChat.jid, url)}
                        onBack={handleBack}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center p-6">
                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm text-muted-foreground hidden md:block">
                                Select a chat to start messaging
                            </p>
                            <p className="text-sm text-muted-foreground md:hidden">
                                Select a chat from the list
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
