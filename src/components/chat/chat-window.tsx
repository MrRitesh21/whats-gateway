"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip, ArrowLeft, Mic, Trash2, Loader2, Maximize2, MessageCircle, Sparkles, History, RotateCw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Image as ImageIcon, FileText, Music, Sticker as StickerIcon, Video, Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createAppSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { getChatMessages, sendChatMessage, sendMediaMessage, getContactProfilePic, syncChatHistory, suggestChatReplies } from "@/app/dashboard/chat/actions";
import { ChatAudioPlayer } from "./chat-audio-player";

interface Message {
    keyId: string;
    content: string;
    fromMe: boolean;
    timestamp: string;
    type: string;
    status: string;
    pushName?: string;
    mediaUrl?: string;
    remoteJid?: string;
}

interface ChatWindowProps {
    sessionId: string;
    jid: string;
    name?: string;
    profilePic?: string | null;
    onProfilePicLoaded?: (url: string) => void;
    onBack?: () => void;
}

interface ImagePreviewModal {
    url: string;
    caption?: string;
    keyId: string;
}

// In-memory cache for instant switching between chats (0ms perceived latency)
const chatMessagesCache = new Map<string, Message[]>();

export function ChatWindow({ sessionId, jid, name, profilePic, onProfilePicLoaded, onBack }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>(() => chatMessagesCache.get(jid) || []);
    const [loading, setLoading] = useState<boolean>(() => !chatMessagesCache.has(jid));
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTypeRef = useRef<string>("image");
    const [uploadType, setUploadType] = useState<string>("image");
    const [isDragging, setIsDragging] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(profilePic || null);
    const [previewImage, setPreviewImage] = useState<ImagePreviewModal | null>(null);

    // History sync & AI reply states
    const [isSyncingHistory, setIsSyncingHistory] = useState(false);
    const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<string>("");

    // Voice message recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isSendingVoice, setIsSendingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const scrollToBottom = (smooth = true) => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
        }
    };

    // Reset AI suggestions when switching chats
    useEffect(() => {
        setShowAiSuggestions(false);
        setAiSuggestions([]);
        setAiAnalysis("");
    }, [jid]);

    const handleSyncHistory = async () => {
        if (isSyncingHistory) return;
        setIsSyncingHistory(true);
        toast.loading("Requesting previous chats from WhatsApp phone...", { id: "sync-history" });
        try {
            const res = await syncChatHistory(sessionId, jid);
            if (res.messages && res.messages.length > 0) {
                setMessages(res.messages as any);
                chatMessagesCache.set(jid, res.messages as any);
                toast.success(`History synced! Total ${res.messages.length} messages loaded.`, { id: "sync-history" });
            } else {
                toast.success("Request sent to WhatsApp phone. Earlier messages will arrive shortly.", { id: "sync-history" });
            }
        } catch (err: any) {
            console.error("Failed to sync chat history:", err);
            toast.error(err.message || "Failed to sync previous messages from WhatsApp", { id: "sync-history" });
        } finally {
            setIsSyncingHistory(false);
        }
    };

    const handleFetchAiSuggestions = async () => {
        setIsGeneratingAiReply(true);
        setShowAiSuggestions(true);
        try {
            const res = await suggestChatReplies(sessionId, jid);
            setAiSuggestions(res.suggestions || []);
            setAiAnalysis(res.analysis || "");
        } catch (err: any) {
            console.error("Failed to generate AI replies:", err);
            toast.error("Failed to generate AI reply suggestions");
        } finally {
            setIsGeneratingAiReply(false);
        }
    };

    const handleApplyAiSuggestion = (suggestion: string) => {
        setNewMessage(suggestion);
        toast.info("Reply inserted into input! Edit or press send.");
    };

    const handleToggleAiSuggestions = () => {
        if (!showAiSuggestions) {
            handleFetchAiSuggestions();
        } else {
            setShowAiSuggestions(false);
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const data = await getChatMessages(sessionId, jid);
            const msgs = (data as any) || [];
            setMessages(msgs);
            chatMessagesCache.set(jid, msgs);
            setTimeout(() => scrollToBottom(false), 50);
        } catch (error) {
            console.error("Failed to load messages via Server Action", error);
        }
    };

    // Update or fetch profile picture
    useEffect(() => {
        // Immediately sync to the new chat's passed profilePic or null
        setAvatarUrl(profilePic || null);

        let isCurrent = true;
        if (!profilePic && sessionId && jid) {
            getContactProfilePic(sessionId, jid)
                .then((url) => {
                    if (isCurrent) {
                        setAvatarUrl(url || null);
                        if (url && onProfilePicLoaded) {
                            onProfilePicLoaded(url);
                        }
                    }
                })
                .catch(() => {
                    if (isCurrent) {
                        setAvatarUrl(null);
                    }
                });
        }

        return () => {
            isCurrent = false;
        };
    }, [sessionId, jid, profilePic, onProfilePicLoaded]);

    useEffect(() => {
        let isCurrent = true;

        const cached = chatMessagesCache.get(jid);
        if (cached && cached.length > 0) {
            setMessages(cached);
            setLoading(false);
        } else {
            setMessages([]);
            setLoading(true);
        }

        getChatMessages(sessionId, jid)
            .then((data) => {
                if (!isCurrent) return;
                const msgs = (data as any) || [];
                setMessages(msgs);
                chatMessagesCache.set(jid, msgs);
            })
            .catch((error) => {
                console.error("Failed to load messages via Server Action", error);
            })
            .finally(() => {
                if (isCurrent) {
                    setLoading(false);
                    setTimeout(() => scrollToBottom(false), 50);
                }
            });

        const newSocket = createAppSocket();

        newSocket.on("connect", () => {
            newSocket.emit("join-session", sessionId);
        });

        const normalizedJid = jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid;

        newSocket.on("message.update", (newMessages: Message[]) => {
            setMessages((prev) => {
                // Find temporary optimistic messages that are now confirmed by the server
                const tempToReplace = new Set<string>();
                newMessages.forEach((nm) => {
                    if (nm.fromMe) {
                        const match = prev.find(p => p.keyId.startsWith("temp-") && p.content === nm.content);
                        if (match) tempToReplace.add(match.keyId);
                    }
                });

                const filteredPrev = prev.filter(p => !tempToReplace.has(p.keyId));
                const combined = [...filteredPrev, ...newMessages.filter(m => 
                    m.remoteJid === normalizedJid || filteredPrev.some(p => p.remoteJid === m.remoteJid)
                )];
                const unique = Array.from(new Map(combined.map(m => [m.keyId, m])).values());
                const sorted = unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                chatMessagesCache.set(jid, sorted);
                return sorted;
            });
        });

        setSocket(newSocket);

        return () => {
            isCurrent = false;
            newSocket.disconnect();
            // Cleanup any active recording on chat switch
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [sessionId, jid]);

    const handleSend = async () => {
        const textToSend = newMessage.trim();
        if (!textToSend) return;

        // 1. Immediately clear input box for 0ms typing response
        setNewMessage("");

        // 2. Generate instant optimistic message
        const tempKeyId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const normalizedJid = jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid;

        const optimisticMsg: Message = {
            keyId: tempKeyId,
            content: textToSend,
            fromMe: true,
            timestamp: new Date().toISOString(),
            type: "TEXT",
            status: "PENDING",
            remoteJid: normalizedJid
        };

        // 3. Instantly render in UI and memory cache (0ms instant send!)
        setMessages((prev) => {
            const updated = [...prev, optimisticMsg];
            chatMessagesCache.set(jid, updated);
            return updated;
        });
        setTimeout(() => scrollToBottom(true), 10);

        // 4. Send to server in background
        try {
            const res = await sendChatMessage(sessionId, jid, textToSend);
            if (res?.keyId) {
                setMessages((prev) => {
                    const updated = prev.map((m) =>
                        m.keyId === tempKeyId
                            ? { ...m, keyId: res.keyId!, status: "SENT", timestamp: res.timestamp || m.timestamp }
                            : m
                    );
                    chatMessagesCache.set(jid, updated);
                    return updated;
                });
            }
        } catch (e: any) {
            console.error("Send error:", e);
            toast.error(e.message || "Failed to send message");
            // Revert optimistic message and restore text
            setMessages((prev) => {
                const updated = prev.filter((m) => m.keyId !== tempKeyId);
                chatMessagesCache.set(jid, updated);
                return updated;
            });
            setNewMessage(textToSend);
        }
    };

    const processFileUpload = async (file: File, explicitType?: string) => {
        const formData = new FormData();
        formData.append("file", file);

        let type = explicitType;
        if (!type || type === '*') {
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else type = 'document';
        }

        formData.append("type", type);
        formData.append("sessionId", sessionId);
        formData.append("jid", jid);

        try {
            toast.info(`Sending ${type === 'voice' ? 'voice message' : file.name}...`);
            await sendMediaMessage(formData);
            toast.success("Sent!");
            // Refresh messages immediately
            fetchMessages();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to send media");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await processFileUpload(file, uploadTypeRef.current);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // --- Voice Recording Logic ---
    const startVoiceRecording = async () => {
        try {
            // Helper to get media devices across browsers
            const getMediaDevices = () => {
                if (typeof navigator === "undefined") return null;
                if (navigator.mediaDevices) {
                    return navigator.mediaDevices;
                }
                const legacyGetUserMedia = 
                    (navigator as any).getUserMedia || 
                    (navigator as any).webkitGetUserMedia || 
                    (navigator as any).mozGetUserMedia || 
                    (navigator as any).msGetUserMedia;
                if (legacyGetUserMedia) {
                    return {
                        getUserMedia: (constraints: MediaStreamConstraints) => {
                            return new Promise<MediaStream>((resolve, reject) => {
                                legacyGetUserMedia.call(navigator, constraints, resolve, reject);
                            });
                        }
                    };
                }
                return null;
            };

            const mediaDevices = getMediaDevices();

            if (!mediaDevices) {
                if (
                    typeof window !== "undefined" &&
                    window.location.protocol !== "https:" &&
                    window.location.hostname !== "localhost" &&
                    window.location.hostname !== "127.0.0.1"
                ) {
                    toast.error("Microphone requires HTTPS or http://localhost. Please access via localhost.");
                    return;
                }
                toast.error("Microphone recording is not supported in this browser.");
                return;
            }

            // Attempt to get user media - with fallback to simple audio if advanced constraints fail
            let stream: MediaStream;
            try {
                stream = await mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    } 
                });
            } catch (constraintErr: any) {
                console.warn("Advanced audio constraints failed, trying basic audio: true", constraintErr);
                stream = await mediaDevices.getUserMedia({ audio: true });
            }

            mediaStreamRef.current = stream;

            // Determine best supported MIME type
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/mp4',
                'audio/aac'
            ];

            let selectedMimeType = '';
            if (typeof MediaRecorder !== "undefined") {
                for (const mime of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(mime)) {
                        selectedMimeType = mime;
                        break;
                    }
                }
            }

            let recorder: MediaRecorder;
            try {
                recorder = selectedMimeType 
                    ? new MediaRecorder(stream, { mimeType: selectedMimeType })
                    : new MediaRecorder(stream);
            } catch {
                recorder = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.start(100); // chunk every 100ms
            setIsRecording(true);
            setRecordingDuration(0);

            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (err: any) {
            console.error("Microphone access error:", err);
            const errName = err?.name || "";
            if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
                toast.error("Microphone permission was denied. Please click the icon in your browser URL bar and allow Microphone access, then refresh.");
            } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
                toast.error("No microphone device found on your computer.");
            } else if (errName === "NotReadableError" || errName === "TrackStartError") {
                toast.error("Microphone is currently in use by another application.");
            } else if (errName === "SecurityError") {
                toast.error("Microphone requires http://localhost or HTTPS.");
            } else {
                toast.error(err.message || "Could not access microphone. Please check permissions.");
            }
        }
    };

    const cancelVoiceRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingDuration(0);
        toast.info("Voice recording cancelled");
    };

    const stopAndSendVoiceRecording = async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") return;

        setIsSendingVoice(true);

        recorder.onstop = async () => {
            try {
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                }
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                }

                const mime = recorder.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: mime });
                const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';
                const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mime });

                await processFileUpload(file, 'voice');
            } catch (err: any) {
                console.error("Error sending voice recording:", err);
                toast.error("Failed to send voice message");
            } finally {
                audioChunksRef.current = [];
                setIsRecording(false);
                setRecordingDuration(0);
                setIsSendingVoice(false);
            }
        };

        recorder.stop();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFileUpload(files[0]);
        }
    };

    const handleDownload = async (url: string, fileName: string) => {
        try {
            toast.info("Downloading file...");
            const response = await fetch(url);
            if (!response.ok) throw new Error("File not found or unreachable");
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error("Download failed", error);
            toast.error("Download failed! Ensure the file URL is accessible.");
        }
    };

    const triggerUpload = (type: string) => {
        setUploadType(type);
        uploadTypeRef.current = type;
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.accept = type === 'image' ? "image/*" : type === 'video' ? "video/*" : type === 'audio' ? "audio/*" : type === 'sticker' ? "image/*" : "*/*";
            fileInputRef.current.click();
        }
    };

    // Format duration to mm:ss
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // Group messages by date
    const getDateLabel = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const displayName = name || jid.split('@')[0];

    return (
        <div 
            className="flex flex-col h-full bg-muted/20 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag & Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center flex-col gap-3 rounded-lg m-2">
                    <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center">
                        <Paperclip className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-lg font-semibold text-primary">Drop files to send here</p>
                </div>
            )}

            {/* Header with Avatar and User Name */}
            <div className="px-3 py-2.5 border-b bg-background/90 backdrop-blur-md flex items-center gap-3 flex-shrink-0 z-10 shadow-xs">
                {onBack && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden flex-shrink-0 text-muted-foreground hover:text-foreground" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <Avatar className="h-9 w-9 flex-shrink-0 ring-1 ring-border/50">
                    {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                        {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{displayName}</h3>
                    <p className="text-[10px] text-muted-foreground truncate">{jid}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isSyncingHistory}
                        onClick={handleSyncHistory}
                        className="h-8 gap-1.5 text-xs font-medium border-border/50 hover:bg-muted/80 transition-colors"
                        title="Fetch previous chats before session connected"
                    >
                        {isSyncingHistory ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                            <History className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="hidden sm:inline">Sync History</span>
                    </Button>
                    <Button
                        variant={showAiSuggestions ? "secondary" : "outline"}
                        size="sm"
                        disabled={isGeneratingAiReply}
                        onClick={handleFetchAiSuggestions}
                        className="h-8 gap-1.5 text-xs font-medium border-border/50 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-purple-600 dark:text-purple-400"
                        title="Analyze chat with AI & get suggested replies"
                    >
                        {isGeneratingAiReply ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                        ) : (
                            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                        )}
                        <span className="hidden sm:inline">AI Reply</span>
                    </Button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 styled-scrollbar relative z-0" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.04) 1px, transparent 0)`,
                backgroundSize: '24px 24px'
            }}>
                <div className="space-y-1.5 max-w-3xl mx-auto min-h-full flex flex-col justify-end">
                    {loading && messages.length === 0 ? (
                        /* Smooth loading skeleton bubbles while fetching */
                        <div className="space-y-3 py-4 w-full animate-pulse">
                            <div className="flex justify-start">
                                <div className="bg-muted/60 border border-border/20 rounded-2xl rounded-bl-md h-12 w-52" />
                            </div>
                            <div className="flex justify-end">
                                <div className="bg-primary/20 rounded-2xl rounded-br-md h-16 w-64" />
                            </div>
                            <div className="flex justify-start">
                                <div className="bg-muted/60 border border-border/20 rounded-2xl rounded-bl-md h-10 w-40" />
                            </div>
                            <div className="flex justify-end">
                                <div className="bg-primary/20 rounded-2xl rounded-br-md h-14 w-56" />
                            </div>
                            <div className="flex justify-start">
                                <div className="bg-muted/60 border border-border/20 rounded-2xl rounded-bl-md h-16 w-72" />
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        /* Empty state */
                        <div className="flex flex-1 min-h-[260px] items-center justify-center text-center my-auto">
                            <div className="p-6 text-muted-foreground/80 max-w-xs">
                                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                    <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm font-semibold text-foreground/80">No messages yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top load older history button */}
                            {messages.length > 0 && (
                                <div className="flex justify-center pb-2 pt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isSyncingHistory}
                                        onClick={handleSyncHistory}
                                        className="h-7 px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-background/60 hover:bg-background/90 backdrop-blur-sm border border-border/30 rounded-full gap-1.5 shadow-xs transition-colors"
                                    >
                                        {isSyncingHistory ? (
                                            <>
                                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                <span>Syncing earlier messages from WhatsApp...</span>
                                            </>
                                        ) : (
                                            <>
                                                <History className="h-3 w-3 text-muted-foreground" />
                                                <span>Load Previous Chats from WhatsApp</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                            {messages.map((msg, idx) => {
                            // Show date separator
                            const showDate = idx === 0 || getDateLabel(msg.timestamp) !== getDateLabel(messages[idx - 1].timestamp);

                            return (
                                <div key={msg.keyId}>
                                    {showDate && (
                                        <div className="flex justify-center my-3">
                                            <span className="text-[10px] font-medium text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-border/30">
                                                {getDateLabel(msg.timestamp)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}>
                                        <div
                                            className={cn(
                                                "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap shadow-sm transition-all",
                                                msg.fromMe
                                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                                    : "bg-background border border-border/40 rounded-bl-md text-foreground"
                                            )}
                                        >
                                            {/* Sender Name (group messages) */}
                                            {!msg.fromMe && jid.endsWith("@g.us") && msg.pushName && (
                                                <span className="text-[11px] font-bold text-primary block mb-1">
                                                    {msg.pushName}
                                                </span>
                                            )}

                                            {/* Image Message */}
                                            {msg.type === 'IMAGE' && msg.mediaUrl && (
                                                <div className="relative group/media mb-1.5 rounded-xl overflow-hidden bg-black/5">
                                                    <img 
                                                        src={msg.mediaUrl} 
                                                        alt="Image" 
                                                        className="rounded-xl max-h-72 object-cover w-full cursor-pointer hover:opacity-95 transition-opacity"
                                                        onClick={() => setPreviewImage({ url: msg.mediaUrl!, caption: msg.content, keyId: msg.keyId })}
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = 'none';
                                                        }}
                                                    />
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/media:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="secondary"
                                                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPreviewImage({ url: msg.mediaUrl!, caption: msg.content, keyId: msg.keyId });
                                                            }}
                                                            title="View full image"
                                                        >
                                                            <Maximize2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="secondary"
                                                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload(msg.mediaUrl!, `IMAGE-${msg.keyId}.jpg`);
                                                            }}
                                                            title="Download image"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video Message */}
                                            {msg.type === 'VIDEO' && msg.mediaUrl && (
                                                <div className="relative group/media mb-1.5 rounded-xl overflow-hidden bg-black/10">
                                                    <video src={msg.mediaUrl} controls className="rounded-xl max-h-72 w-full" preload="metadata" />
                                                    <Button
                                                        size="icon"
                                                        variant="secondary"
                                                        className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-100 sm:opacity-0 sm:group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm z-10"
                                                        onClick={() => handleDownload(msg.mediaUrl!, `VIDEO-${msg.keyId}.mp4`)}
                                                        title="Download video"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Audio Voice Note / Audio Player */}
                                            {msg.type === 'AUDIO' && msg.mediaUrl && (
                                                <div className="mb-1">
                                                    <ChatAudioPlayer
                                                        src={msg.mediaUrl}
                                                        fromMe={msg.fromMe}
                                                        fileName={`AUDIO-${msg.keyId}.mp3`}
                                                        onDownload={() => handleDownload(msg.mediaUrl!, `AUDIO-${msg.keyId}.mp3`)}
                                                    />
                                                </div>
                                            )}

                                            {/* Sticker Message */}
                                            {msg.type === 'STICKER' && msg.mediaUrl && (
                                                <div className="relative group/media mb-1">
                                                    <img 
                                                        src={msg.mediaUrl} 
                                                        alt="Sticker" 
                                                        className="rounded-lg max-h-36 object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="secondary"
                                                        className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                                                        onClick={() => handleDownload(msg.mediaUrl!, `STICKER-${msg.keyId}.webp`)}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Document & Other Types */}
                                            {msg.type !== 'TEXT' && msg.type !== 'IMAGE' && msg.type !== 'STICKER' && msg.type !== 'VIDEO' && msg.type !== 'AUDIO' && (
                                                <div className={cn(
                                                    "flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg mb-1 text-xs",
                                                    msg.fromMe ? "bg-white/15" : "bg-muted/60"
                                                )}>
                                                    <div className="flex items-center gap-2 truncate">
                                                        <FileText className="h-4 w-4 flex-shrink-0" />
                                                        <span className="font-medium truncate">{msg.content || `${msg.type} File`}</span>
                                                    </div>
                                                    {msg.mediaUrl && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className={cn("h-7 w-7 rounded-full flex-shrink-0", msg.fromMe ? "hover:bg-white/20 text-white" : "hover:bg-muted")}
                                                            onClick={() => handleDownload(msg.mediaUrl!, `${msg.type}-${msg.keyId}`)}
                                                            title="Download file"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Content Text + Timestamp */}
                                            <div className="flex items-end gap-2">
                                                {msg.type !== 'AUDIO' && msg.content && (
                                                    <span className="flex-1 leading-relaxed">{msg.content}</span>
                                                )}
                                                {(!msg.content || msg.type === 'AUDIO') && <div className="flex-1" />}
                                                <span className={cn(
                                                    "text-[9px] flex-shrink-0 leading-none translate-y-0.5 select-none font-medium",
                                                    msg.fromMe ? "text-primary-foreground/75" : "text-muted-foreground"
                                                )}>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        </>
                    )}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-background/90 backdrop-blur-md border-t flex-shrink-0">
                {/* AI Smart Suggestions Bar */}
                {showAiSuggestions && (
                    <div className="max-w-3xl mx-auto mb-2.5 p-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-primary/10 border border-purple-500/20 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                                <span>AI Suggested Replies</span>
                                {aiAnalysis && (
                                    <span className="text-[10px] font-normal text-muted-foreground truncate hidden sm:inline">
                                        • {aiAnalysis}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleFetchAiSuggestions}
                                    disabled={isGeneratingAiReply}
                                    className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                                    title="Regenerate suggestions"
                                >
                                    <RotateCw className={cn("h-3 w-3", isGeneratingAiReply && "animate-spin")} />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowAiSuggestions(false)}
                                    className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                                    title="Close suggestions"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {isGeneratingAiReply ? (
                            <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                                <span>Analyzing conversation & generating replies...</span>
                            </div>
                        ) : aiSuggestions.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {aiSuggestions.map((suggestion, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleApplyAiSuggestion(suggestion)}
                                        className="group text-left text-xs bg-background/90 hover:bg-purple-600 hover:text-white border border-border/40 hover:border-purple-600 rounded-lg px-2.5 py-1.5 transition-all duration-150 shadow-xs flex items-center gap-1.5 cursor-pointer"
                                        title="Click to insert into message"
                                    >
                                        <span className="font-semibold text-[10px] px-1 py-0.2 rounded bg-purple-500/15 group-hover:bg-white/20 text-purple-600 dark:text-purple-300 group-hover:text-white">
                                            {i === 0 ? "⚡ Direct" : i === 1 ? "💼 Details" : "🎯 Next Step"}
                                        </span>
                                        <span className="truncate max-w-[280px] sm:max-w-md">{suggestion}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-1 text-xs text-muted-foreground">
                                No suggestions generated yet. Click reload to try again.
                            </div>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 max-w-3xl mx-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                    />

                    {isRecording ? (
                        /* Active Voice Recording Bar */
                        <div className="flex-1 flex items-center justify-between gap-3 bg-red-500/10 dark:bg-red-950/30 border border-red-500/30 rounded-full px-3 py-1.5 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2.5">
                                <div className="relative flex items-center justify-center">
                                    <span className="absolute h-3 w-3 rounded-full bg-red-500 animate-ping opacity-75" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                                </div>
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                                    Recording {formatDuration(recordingDuration)}
                                </span>
                            </div>

                            {/* Audio waveform simulation */}
                            <div className="flex items-center gap-1">
                                <span className="h-2 w-0.5 bg-red-500/60 rounded-full animate-pulse" />
                                <span className="h-4 w-0.5 bg-red-500 rounded-full animate-pulse delay-75" />
                                <span className="h-3 w-0.5 bg-red-500/80 rounded-full animate-pulse delay-150" />
                                <span className="h-5 w-0.5 bg-red-500 rounded-full animate-pulse delay-100" />
                                <span className="h-2 w-0.5 bg-red-500/60 rounded-full animate-pulse delay-200" />
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* Cancel Button */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelVoiceRecording}
                                    disabled={isSendingVoice}
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    title="Cancel recording"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>

                                {/* Send Voice Message Button */}
                                <Button
                                    type="button"
                                    size="icon"
                                    onClick={stopAndSendVoiceRecording}
                                    disabled={isSendingVoice}
                                    className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xs"
                                    title="Send voice message"
                                >
                                    {isSendingVoice ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Standard Text & Media Bar */
                        <>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground">
                                        <Paperclip className="h-4.5 w-4.5" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-44 p-1.5" side="top" align="start">
                                    <div className="flex flex-col gap-0.5">
                                        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('image')}>
                                            <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> Image
                                        </Button>
                                        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('video')}>
                                            <Video className="h-3.5 w-3.5 text-gray-500" /> Video
                                        </Button>
                                        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('audio')}>
                                            <Music className="h-3.5 w-3.5 text-orange-500" /> Audio
                                        </Button>
                                        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('document')}>
                                            <FileText className="h-3.5 w-3.5 text-blue-500" /> Document
                                        </Button>
                                        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8 text-xs" onClick={() => triggerUpload('sticker')}>
                                            <StickerIcon className="h-3.5 w-3.5 text-pink-500" /> Sticker
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Input
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                className="flex-1 h-9 rounded-full bg-muted/40 border-border/30 text-sm focus-visible:ring-1"
                            />

                            {/* AI Suggest Button in Input Row */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleToggleAiSuggestions}
                                disabled={isGeneratingAiReply}
                                className={cn(
                                    "h-9 w-9 rounded-full flex-shrink-0 transition-colors",
                                    showAiSuggestions ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10"
                                )}
                                title="AI Reply Suggestions"
                            >
                                {isGeneratingAiReply ? (
                                    <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-500" />
                                ) : (
                                    <Sparkles className="h-4.5 w-4.5" />
                                )}
                            </Button>

                            {/* Voice Record Button */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={startVoiceRecording}
                                className="h-9 w-9 rounded-full flex-shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Record Voice Message"
                            >
                                <Mic className="h-4.5 w-4.5" />
                            </Button>

                            {/* Send Text Button */}
                            <Button
                                onClick={handleSend}
                                disabled={!newMessage.trim()}
                                size="icon"
                                className="h-9 w-9 rounded-full flex-shrink-0 shadow-xs"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Image Preview Lightbox Modal */}
            {previewImage && (
                <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                    <DialogContent className="max-w-4xl p-2 sm:p-4 bg-background/95 backdrop-blur-xl border-border/50">
                        <DialogTitle className="sr-only">Image Preview</DialogTitle>
                        <div className="flex flex-col items-center justify-center gap-3">
                            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-lg bg-black/5">
                                <img
                                    src={previewImage.url}
                                    alt="Preview"
                                    className="max-h-[75vh] w-auto object-contain rounded-lg shadow-md"
                                />
                            </div>
                            {previewImage.caption && (
                                <p className="text-sm text-foreground text-center px-4 max-w-2xl">
                                    {previewImage.caption}
                                </p>
                            )}
                            <div className="flex items-center gap-2 justify-end w-full pt-1">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => handleDownload(previewImage.url, `IMAGE-${previewImage.keyId}.jpg`)}
                                >
                                    <Download className="h-4 w-4" /> Download
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPreviewImage(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
