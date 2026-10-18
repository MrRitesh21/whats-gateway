import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { hashApiKey, getAccessibleSessions, canAccessSession } from "./api-auth";
import { waManager } from "@/modules/whatsapp/manager";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { normalizeJid } from "./jid-utils";
import { logger } from "./logger";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface McpUser {
    id: string;
    email: string;
    name: string | null;
    role: string;
    plan?: string;
    planExpiresAt?: Date | null;
}

export interface McpSseClient {
    sessionId: string;
    apiKey: string;
    user: McpUser;
    send: (event: string, data: any) => void;
    close: () => void;
    createdAt: Date;
}

export interface JsonRpcRequest {
    jsonrpc: string;
    id?: string | number | null;
    method: string;
    params?: any;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// In-memory registry of active SSE clients
const sseClients = new Map<string, McpSseClient>();

export function registerSseClient(client: McpSseClient): void {
    sseClients.set(client.sessionId, client);
}

export function getSseClient(sessionId: string): McpSseClient | undefined {
    return sseClients.get(sessionId);
}

export function removeSseClient(sessionId: string): void {
    const client = sseClients.get(sessionId);
    if (client) {
        try {
            client.close();
        } catch {
            /* ignore */
        }
        sseClients.delete(sessionId);
    }
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Extract and validate API Key from query parameters or headers.
 * Supports:
 * - ?key=YOUR_API_KEY (matching Wassenger format: /mcp?key=...)
 * - ?apiKey=YOUR_API_KEY
 * - Header: x-api-key: YOUR_API_KEY
 * - Header: Authorization: Bearer YOUR_API_KEY
 */
export async function validateMcpAuth(request: NextRequest): Promise<{ user: McpUser; apiKey: string } | null> {
    const url = new URL(request.url);
    let rawKey = url.searchParams.get("key") || url.searchParams.get("apiKey");

    if (!rawKey) {
        rawKey = request.headers.get("x-api-key");
    }

    if (!rawKey) {
        const authHeader = request.headers.get("authorization");
        if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            rawKey = authHeader.slice(7).trim();
        }
    }

    if (!rawKey) {
        return null;
    }

    const hashed = hashApiKey(rawKey);

    try {
        const user = await prisma.user.findFirst({
            where: { OR: [{ apiKey: hashed }, { apiKey: rawKey }] },
            select: { id: true, email: true, name: true, role: true, plan: true, planExpiresAt: true }
        });

        if (!user) return null;
        return { user, apiKey: rawKey };
    } catch {
        try {
            const user = await prisma.user.findFirst({
                where: { OR: [{ apiKey: hashed }, { apiKey: rawKey }] },
                select: { id: true, email: true, name: true, role: true }
            });
            if (!user) return null;
            return { user: { ...user, plan: "FREE", planExpiresAt: null }, apiKey: rawKey };
        } catch (e2) {
            logger.error("MCP", "API key validation error:", e2);
            return null;
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

export function toWhatsAppJid(input: string): string {
    const trimmed = (input || "").trim();
    if (trimmed.includes("@")) {
        return normalizeJid(trimmed);
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    return `${digitsOnly}@s.whatsapp.net`;
}

/**
 * Resolve session for a user. If requestedSessionId is provided, validates access.
 * Otherwise, picks the first active connected session, or the first available session.
 */
async function resolveUserSession(user: McpUser, requestedSessionId?: string) {
    const sessions = await getAccessibleSessions(user.id, user.role);
    if (!sessions || sessions.length === 0) {
        throw new Error("No WhatsApp sessions found on this account. Please create and connect a session first.");
    }

    if (requestedSessionId) {
        const found = sessions.find(s => s.id === requestedSessionId || s.sessionId === requestedSessionId);
        if (!found) {
            const hasAccess = await canAccessSession(user.id, user.role, requestedSessionId);
            if (!hasAccess) {
                throw new Error(`Forbidden: You do not have access to session '${requestedSessionId}'`);
            }
            const dbSession = await prisma.session.findFirst({
                where: { OR: [{ id: requestedSessionId }, { sessionId: requestedSessionId }] }
            });
            if (!dbSession) throw new Error(`Session '${requestedSessionId}' not found.`);
            return dbSession;
        }
        return found;
    }

    // Auto-select connected session
    const connected = sessions.find(s => {
        const inst = waManager.getInstance(s.sessionId);
        return inst && inst.status === "CONNECTED";
    });

    return connected || sessions[0];
}

// ============================================================================
// MCP Tools Definition
// ============================================================================

export const MCP_TOOLS = [
    {
        name: "whatsapp_list_sessions",
        description: "List all WhatsApp devices/sessions connected to your account, including their phone numbers, push names, and live connection status (CONNECTED, QR, DISCONNECTED).",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "whatsapp_send_message",
        description: "Send a WhatsApp text message to any phone number or group. Automatically formats country codes and phone numbers.",
        inputSchema: {
            type: "object",
            properties: {
                phone: {
                    type: "string",
                    description: "Recipient phone number with country code (e.g. +1234567890, 919876543210) or WhatsApp JID"
                },
                message: {
                    type: "string",
                    description: "The text message content to send"
                },
                sessionId: {
                    type: "string",
                    description: "Optional session ID or device name. If omitted, uses your primary connected WhatsApp session."
                }
            },
            required: ["phone", "message"]
        }
    },
    {
        name: "whatsapp_get_chats",
        description: "Retrieve recent active WhatsApp conversations and chats, including contact names, phone numbers, and last message previews.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: {
                    type: "string",
                    description: "Optional session ID. If omitted, uses your primary active session."
                }
            },
            required: []
        }
    },
    {
        name: "whatsapp_get_messages",
        description: "Retrieve recent chat message history with a specific contact or group.",
        inputSchema: {
            type: "object",
            properties: {
                phone: {
                    type: "string",
                    description: "Phone number with country code or WhatsApp JID"
                },
                limit: {
                    type: "number",
                    description: "Number of recent messages to return (default: 20, max: 100)"
                },
                sessionId: {
                    type: "string",
                    description: "Optional session ID"
                }
            },
            required: ["phone"]
        }
    },
    {
        name: "whatsapp_check_number",
        description: "Check if a phone number is registered and active on WhatsApp, and get its verified WhatsApp JID.",
        inputSchema: {
            type: "object",
            properties: {
                phone: {
                    type: "string",
                    description: "Phone number with country code to verify (e.g. +1234567890 or 919876543210)"
                },
                sessionId: {
                    type: "string",
                    description: "Optional session ID"
                }
            },
            required: ["phone"]
        }
    },
    {
        name: "whatsapp_list_contacts",
        description: "List or search saved WhatsApp contacts for a connected WhatsApp session.",
        inputSchema: {
            type: "object",
            properties: {
                search: {
                    type: "string",
                    description: "Optional search query to filter contacts by name or phone"
                },
                limit: {
                    type: "number",
                    description: "Maximum number of contacts to retrieve (default: 50)"
                },
                sessionId: {
                    type: "string",
                    description: "Optional session ID"
                }
            },
            required: []
        }
    },
    {
        name: "whatsapp_list_groups",
        description: "List all WhatsApp groups that the connected account participates in.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: {
                    type: "string",
                    description: "Optional session ID"
                }
            },
            required: []
        }
    },
    {
        name: "whatsapp_get_account_info",
        description: "Get the current authenticated user profile, plan, role, and gateway configuration details.",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    }
];

// ============================================================================
// Tool Execution Engine
// ============================================================================

export async function executeMcpTool(name: string, args: any, user: McpUser): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (name) {
            case "whatsapp_list_sessions": {
                const sessions = await getAccessibleSessions(user.id, user.role);
                const results = sessions.map(s => {
                    const inst = waManager.getInstance(s.sessionId);
                    const socketUser: any = inst?.socket?.user;
                    const phone = socketUser?.id ? socketUser.id.split(":")[0].split("@")[0] : null;
                    return {
                        id: s.id,
                        sessionId: s.sessionId,
                        name: s.name,
                        status: inst ? inst.status : s.status,
                        phone: phone || "Not available",
                        pushName: socketUser?.name || null,
                        createdAt: s.createdAt
                    };
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ sessions: results, count: results.length }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_send_message": {
                const { phone, message, sessionId } = args || {};
                if (!phone || !message) {
                    throw new Error("Both 'phone' and 'message' parameters are required.");
                }

                const targetSession = await resolveUserSession(user, sessionId);
                const jid = toWhatsAppJid(phone);

                await ChatService.sendTextMessage(targetSession.sessionId, jid, { text: message });

                return {
                    content: [
                        {
                            type: "text",
                            text: `✅ WhatsApp message successfully sent to ${phone} (${jid}) using session '${targetSession.name}' (${targetSession.sessionId}).`
                        }
                    ]
                };
            }

            case "whatsapp_get_chats": {
                const targetSession = await resolveUserSession(user, args?.sessionId);
                const chats = await ChatService.getChatsList(targetSession.id);

                const formatted = (chats || []).slice(0, 50).map((c: any) => ({
                    jid: c.jid,
                    name: c.name || c.notify || "Unknown",
                    lastMessage: c.lastMessage || null,
                    lastMessageTimestamp: c.lastMessageTimestamp || null
                }));

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ session: targetSession.name, totalChats: formatted.length, chats: formatted }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_get_messages": {
                const { phone, limit, sessionId } = args || {};
                if (!phone) throw new Error("'phone' parameter is required.");

                const targetSession = await resolveUserSession(user, sessionId);
                const jid = toWhatsAppJid(phone);
                const take = Math.min(Math.max(1, parseInt(String(limit || 20), 10)), 100);

                const messages = await ChatService.getMessages(targetSession.id, jid, take);

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ session: targetSession.name, jid, count: messages.length, messages }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_check_number": {
                const { phone, sessionId } = args || {};
                if (!phone) throw new Error("'phone' parameter is required.");

                const targetSession = await resolveUserSession(user, sessionId);
                const instance = waManager.getInstance(targetSession.sessionId);

                if (!instance || !instance.socket || instance.status !== "CONNECTED") {
                    throw new Error(`Session '${targetSession.name}' is not currently connected.`);
                }

                const cleanNumber = phone.replace(/\D/g, "");
                const checkResult = await instance.socket.onWhatsApp(cleanNumber);

                if (Array.isArray(checkResult) && checkResult.length > 0 && checkResult[0].exists) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    phone,
                                    registered: true,
                                    jid: checkResult[0].jid
                                }, null, 2)
                            }
                        ]
                    };
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                phone,
                                registered: false,
                                message: "Number is not registered on WhatsApp."
                            }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_list_contacts": {
                const targetSession = await resolveUserSession(user, args?.sessionId);
                const search = args?.search?.trim() || "";
                const limit = Math.min(Math.max(1, parseInt(String(args?.limit || 50), 10)), 200);

                const whereClause: any = { sessionId: targetSession.id };
                if (search) {
                    whereClause.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { jid: { contains: search, mode: "insensitive" } },
                        { notify: { contains: search, mode: "insensitive" } }
                    ];
                }

                const contacts = await prisma.contact.findMany({
                    where: whereClause,
                    select: { jid: true, name: true, notify: true, updatedAt: true },
                    take: limit,
                    orderBy: { updatedAt: "desc" }
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ session: targetSession.name, count: contacts.length, contacts }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_list_groups": {
                const targetSession = await resolveUserSession(user, args?.sessionId);
                const groups = await prisma.group.findMany({
                    where: { sessionId: targetSession.id },
                    select: { jid: true, subject: true, description: true, ownerJid: true, announce: true },
                    orderBy: { updatedAt: "desc" }
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ session: targetSession.name, count: groups.length, groups }, null, 2)
                        }
                    ]
                };
            }

            case "whatsapp_get_account_info": {
                const sessions = await getAccessibleSessions(user.id, user.role);
                const connectedCount = sessions.filter(s => {
                    const inst = waManager.getInstance(s.sessionId);
                    return inst && inst.status === "CONNECTED";
                }).length;

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                user: {
                                    id: user.id,
                                    email: user.email,
                                    name: user.name,
                                    role: user.role,
                                    plan: user.plan || "STANDARD"
                                },
                                sessionsTotal: sessions.length,
                                sessionsConnected: connectedCount,
                                server: "WeBotApp WhatsApp Gateway v1.5.4",
                                protocolVersion: "2024-11-05"
                            }, null, 2)
                        }
                    ]
                };
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true
                };
        }
    } catch (err: any) {
        return {
            content: [{ type: "text", text: `Error executing ${name}: ${err?.message || String(err)}` }],
            isError: true
        };
    }
}

// ============================================================================
// JSON-RPC 2.0 Dispatcher
// ============================================================================

export async function processJsonRpcRequest(rpc: JsonRpcRequest, user: McpUser): Promise<JsonRpcResponse | null> {
    const id = rpc.id !== undefined ? rpc.id : null;
    const method = rpc.method;

    // Notifications (no id) do not expect a response
    if (id === null && method.startsWith("notifications/")) {
        return null;
    }

    switch (method) {
        case "initialize":
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion: "2024-11-05",
                    capabilities: {
                        tools: {
                            listChanged: false
                        }
                    },
                    serverInfo: {
                        name: "webotapp-whatsapp-mcp",
                        version: "1.5.4"
                    },
                    instructions: "This MCP server provides full access to your WeBotApp WhatsApp Gateway. You can send messages, check phone registrations, query active chats, and inspect connected WhatsApp sessions."
                }
            };

        case "ping":
            return {
                jsonrpc: "2.0",
                id,
                result: {}
            };

        case "tools/list":
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    tools: MCP_TOOLS
                }
            };

        case "tools/call": {
            const toolName = rpc.params?.name;
            const toolArgs = rpc.params?.arguments || {};
            const result = await executeMcpTool(toolName, toolArgs, user);
            return {
                jsonrpc: "2.0",
                id,
                result
            };
        }

        case "resources/list":
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    resources: []
                }
            };

        case "prompts/list":
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    prompts: []
                }
            };

        default:
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: -32601,
                    message: `Method '${method}' not found`
                }
            };
    }
}
