"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Send, CheckCircle2, XCircle, Radio, Clock, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { createAppSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";

import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";

interface MulticastProgress {
    multicastId: string;
    status: "running" | "completed";
    total: number;
    sent: number;
    failed: number;
    current?: string | null;
    progress?: number;
    errors: { jid: string; error: string; sessionId: string }[];
    startedAt?: string;
    completedAt?: string;
    sessionId: string; // The session that sent the current message
}

export default function MulticastPage() {
    const { sessionId: currentSessionId } = useSession(); // Current user's session for auth
    const [availableSessions, setAvailableSessions] = useState<Array<{ id: string; name: string; status: string }>>([]);
    const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
    const [contacts, setContacts] = useState("");
    const [message, setMessage] = useState("");
    const [delay, setDelay] = useState([2000]);
    const [distributionStrategy, setDistributionStrategy] = useState("round_robin");
    const [loading, setLoading] = useState(false);
    const [multicastProgress, setMulticastProgress] = useState<MulticastProgress | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!currentSessionId) return;

        const socket = createAppSocket();

        socket.on("connect", () => {
            socket.emit("join-session", currentSessionId);
        });

        socket.on("sessions.list", (sessions: Array<{ id: string; name: string; status: string }>) => {
            setAvailableSessions(sessions);
            // Auto-select the current session if not already selected
            if (sessions.some((s: { id: string; name: string; status: string }) => s.id === currentSessionId) && !selectedSessionIds.includes(currentSessionId)) {
                setSelectedSessionIds(prev => [...prev, currentSessionId]);
            }
        });

        socket.on("multicast.progress", (data: MulticastProgress) => {
            setMulticastProgress(data);

            if (data.status === "completed") {
                setLoading(false);
                if (data.failed === 0) {
                    toast.success(`Multicast completed! ${data.sent} messages sent using ${data.errors.length > 0 ? data.errors.map(e => e.sessionId).filter((v,i,a)=>a.indexOf(v)===i).length : 1} session(s).`);
                } else {
                    toast.warning(`Multicast completed. ${data.sent} sent, ${data.failed} failed.`);
                }
            }
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [currentSessionId, selectedSessionIds]);

    // Fetch available sessions on mount
    useEffect(() => {
        if (currentSessionId) {
            fetchAvailableSessions();
        }
    }, [currentSessionId]);

    const fetchAvailableSessions = async () => {
        try {
            const res = await fetch(`/api/sessions`);
            if (res.ok) {
                const data = await res.json();
                if (data.status) {
                    setAvailableSessions(data.data || []);
                    // Auto-select current session
                    if (data.data && data.data.some((s: { id: string; name: string; status: string }) => s.id === currentSessionId) && !selectedSessionIds.includes(currentSessionId)) {
                        setSelectedSessionIds(prev => [...prev, currentSessionId]);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch sessions:", error);
            toast.error("Failed to fetch available sessions");
        }
    };

    const handleSelectSession = (sessionId: string) => {
        setSelectedSessionIds(prev => 
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    const handleSend = async () => {
        if (!currentSessionId) return toast.error("No active session found");
        if (!message.trim()) return toast.error("Message cannot be empty");
        if (selectedSessionIds.length === 0) return toast.error("Please select at least one session");
        setLoading(true);
        setMulticastProgress(null);

        try {
            const recipients = contacts.split(/[\\n,]+/).map(s => s.trim()).filter(Boolean).map(s => {
                if (!s.includes('@')) return `${s}@s.whatsapp.net`;
                return s;
            });

            if (recipients.length === 0) {
                toast.error("No recipients specified");
                setLoading(false);
                return;
            }

            const res = await fetch("/api/multicast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionIds: selectedSessionIds,
                    recipients,
                    message: message,
                    delay: delay[0],
                    distributionStrategy
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.info(`Multicast started for ${recipients.length} recipient(s) using ${selectedSessionIds.length} session(s)...`);
            } else {
                toast.error(data.message || "Failed to start multicast");
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            toast.error("Error sending multicast");
            setLoading(false);
        }
    };

    const recipientCount = contacts.split(/[\\n,]+/).map(s => s.trim()).filter(Boolean).length;

    const formatJid = (jid: string) => {
        if (!jid) return "-";
        return jid.replace("@s.whatsapp.net", "").replace("@g.us", " (Group)");
    };

    return (
        <SessionGuard>
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Multicast / Multi-Session Broadcast</h2>
                    <p className="text-muted-foreground text-sm mt-1">Send bulk messages to multiple recipients using multiple WhatsApp sessions simultaneously.</p>
                </div>

                <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
                    {/* Sessions Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>WhatsApp Sessions</CardTitle>
                            <CardDescription>Select which sessions to use for sending messages</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between mb-3">
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => {
                                        // Toggle all sessions
                                        const allSelected = availableSessions.length > 0 && 
                                                          availableSessions.every(s => selectedSessionIds.includes(s.id));
                                        if (allSelected) {
                                            setSelectedSessionIds([]);
                                        } else {
                                            setSelectedSessionIds(availableSessions.map(s => s.id));
                                        }
                                    }}
                                >
                                    {availableSessions.length > 0 && 
                                     availableSessions.every(s => selectedSessionIds.includes(s.id)) ? (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    )}
                                    Select All
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    {selectedSessionIds.length} of {availableSessions.length} sessions selected
                                </span>
                            </div>
                            
                            {availableSessions.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No sessions available. Please connect your WhatsApp sessions first.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {availableSessions.map((session: { id: string; name: string; status: string }) => (
                                        <div key={session.id} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Checkbox 
                                                    checked={selectedSessionIds.includes(session.id)}
                                                    onCheckedChange={(checked: boolean) => {
                                                        if (checked) {
                                                            setSelectedSessionIds(prev => [...prev, session.id]);
                                                        } else {
                                                            setSelectedSessionIds(prev => prev.filter(id => id !== session.id));
                                                        }
                                                    }}
                                                    className="h-4 w-4"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold">{session.name}</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Status: {session.status.toLowerCase() === "connected" ? (
                                                            <span className="text-green-600">● Connected</span>
                                                        ) : session.status.toLowerCase() === "disconnected" ? (
                                                            <span className="text-red-600">● Disconnected</span>
                                                        ) : (
                                                            <span className="text-yellow-600">● {session.status}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recipients Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recipients</CardTitle>
                            <CardDescription>Enter phone numbers separated by comma or new line.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Target Numbers (e.g., 628123456789)</Label>
                                <Textarea
                                    placeholder="628123456789\\n628987654321"
                                    className="min-h-[200px] font-mono text-sm"
                                    value={contacts}
                                    onChange={e => setContacts(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Message & Settings Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Message &amp; Settings</CardTitle>
                            <CardDescription>Compose message and configure delivery settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Message Content</Label>
                                <Textarea
                                    placeholder="Type your message here..."
                                    className="min-h-[140px] text-sm"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <Label>Delay Between Messages</Label>
                                    <span className="font-mono text-xs">{delay[0]}ms</span>
                                </div>
                                <Slider
                                    min={500}
                                    max={10000}
                                    step={500}
                                    value={delay}
                                    onValueChange={setDelay}
                                    disabled={loading}
                                />
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleSend}
                                disabled={loading || selectedSessionIds.length === 0 || recipientCount === 0 || !message.trim()}
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Start Multicast
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {multicastProgress && (
                    <Card className={`border-2 transition-colors ${
                        multicastProgress.status === "completed" 
                            ? (multicastProgress.failed === 0 ? "border-green-500/30 bg-green-50/30 dark:bg-green-950/10" : "border-yellow-500/30 bg-yellow-50/30 dark:bg-yellow-950/10")
                            : "border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10"
                    }`}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                {multicastProgress.status === "running" ? (
                                    <>
                                        <Radio className="h-5 w-5 text-blue-500 animate-pulse" />
                                        <span>Multicast In Progress</span>
                                    </>
                                ) : multicastProgress.failed === 0 ? (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        <span>Multicast Completed</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                        <span>Multicast Completed with Errors</span>
                                    </>
                                )}
                            </CardTitle>
                            <CardDescription>
                                ID: {multicastProgress.multicastId} | 
                                Sessions: {multicastProgress.errors.length > 0 ? [...new Set(multicastProgress.errors.map(e => e.sessionId))].length : multicastProgress.sessionId ? 1 : 0}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span className="font-mono font-medium">
                                        {multicastProgress.sent + multicastProgress.failed} / {multicastProgress.total}
                                        {" "}({multicastProgress.progress || 0}%)
                                    </span>
                                </div>
                                <Progress value={multicastProgress.progress || 0} className="h-3" />
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-background rounded-lg p-3 text-center border">
                                    <div className="text-2xl font-bold text-green-600">{multicastProgress.sent}</div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                        <CheckCircle2 className="h-3 w-3" /> Sent
                                    </div>
                                </div>
                                <div className="bg-background rounded-lg p-3 text-center border">
                                    <div className="text-2xl font-bold text-red-500">{multicastProgress.failed}</div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                        <XCircle className="h-3 w-3" /> Failed
                                    </div>
                                </div>
                                <div className="bg-background rounded-lg p-3 text-center border">
                                    <div className="text-2xl font-bold text-muted-foreground">
                                        {multicastProgress.total - multicastProgress.sent - multicastProgress.failed}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                        <Clock className="h-3 w-3" /> Pending
                                    </div>
                                </div>
                                <div className="bg-background rounded-lg p-3 text-center border">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {multicastProgress.errors.length > 0 ? [...new Set(multicastProgress.errors.map(e => e.sessionId))].length : 1}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                        <Users className="h-3 w-3" /> Sessions Used
                                    </div>
                                </div>
                            </div>

                            {/* Current recipient */}
                            {multicastProgress.status === "running" && multicastProgress.current && (
                                <div className="flex items-center gap-2 text-sm px-3 py-2 bg-muted/50 rounded-lg">
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                    <span className="text-muted-foreground">Last sent to:</span>
                                    <span className="font-mono font-medium">{formatJid(multicastProgress.current)}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">(via session: {multicastProgress.sessionId})</span>
                                </div>
                            )}

                            {/* Error details */}
                            {multicastProgress.status === "completed" && multicastProgress.errors && multicastProgress.errors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                                        <XCircle className="h-4 w-4" />
                                        Failed Recipients ({multicastProgress.errors.length})
                                    </h4>
                                    <div className="max-h-40 overflow-y-auto bg-red-50 dark:bg-red-950/30 rounded-lg p-2 space-y-1">
                                        {multicastProgress.errors.map((err, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs py-1 px-2 bg-background/60 rounded">
                                                <span className="font-mono">{formatJid(err.jid)}</span>
                                                <span className="text-red-500 truncate ml-2 max-w-[200px]">{err.error}</span>
                                                <span className="ml-2 text-xs text-muted-foreground">(session: {err.sessionId})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </SessionGuard>
    );
}