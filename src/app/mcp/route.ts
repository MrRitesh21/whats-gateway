import { NextRequest, NextResponse } from "next/server";
import { validateMcpAuth, registerSseClient, removeSseClient, processJsonRpcRequest, MCP_TOOLS } from "@/lib/mcp";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key"
};

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
}

/**
 * GET /mcp?key=YOUR_API_KEY
 * - If Accept: text/event-stream (MCP client like Claude Desktop): returns SSE stream with endpoint event
 * - If regular browser GET: returns server status and documentation JSON
 */
export async function GET(request: NextRequest) {
    const authResult = await validateMcpAuth(request);

    if (!authResult) {
        return NextResponse.json(
            {
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Unauthorized: Invalid or missing API key. Provide via ?key=YOUR_KEY or x-api-key header."
                },
                id: null
            },
            { status: 401, headers: CORS_HEADERS }
        );
    }

    const { user, apiKey } = authResult;
    const accept = request.headers.get("accept") || "";
    const isSse = accept.includes("text/event-stream") || request.nextUrl.searchParams.get("sse") === "true";

    // If regular browser inspects the URL, return documentation & status
    if (!isSse) {
        return NextResponse.json(
            {
                status: true,
                service: "WeBotApp WhatsApp Model Context Protocol (MCP) Server",
                version: "1.5.4",
                protocolVersion: "2024-11-05",
                authenticatedUser: {
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                mcpUrl: `${request.nextUrl.origin}/mcp?key=${apiKey}`,
                messagesEndpoint: `${request.nextUrl.origin}/mcp/messages`,
                claudeConfigExample: {
                    mcpServers: {
                        whatsapp: {
                            url: `${request.nextUrl.origin}/mcp?key=${apiKey}`
                        }
                    }
                },
                tools: MCP_TOOLS.map(t => ({
                    name: t.name,
                    description: t.description
                }))
            },
            { headers: CORS_HEADERS }
        );
    }

    // Handle SSE Connection (Standard MCP remote transport for Claude Desktop / Claude Code)
    const mcpSessionId = "mcp_" + crypto.randomUUID().replace(/-/g, "");
    let keepAliveInterval: NodeJS.Timeout | null = null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Function to push SSE events
            const sendEvent = (event: string, data: any) => {
                try {
                    const text = typeof data === "string" ? data : JSON.stringify(data);
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${text}\n\n`));
                } catch {
                    /* stream closed */
                }
            };

            const closeConnection = () => {
                if (keepAliveInterval) {
                    clearInterval(keepAliveInterval);
                    keepAliveInterval = null;
                }
                try {
                    controller.close();
                } catch {
                    /* ignore */
                }
            };

            // Register client in active memory
            registerSseClient({
                sessionId: mcpSessionId,
                apiKey,
                user,
                send: sendEvent,
                close: closeConnection,
                createdAt: new Date()
            });

            // Send initial endpoint event (MCP Standard)
            // Points Claude to the POST endpoint where it should deliver JSON-RPC messages
            const endpointUri = `/mcp/messages?sessionId=${mcpSessionId}&key=${encodeURIComponent(apiKey)}`;
            sendEvent("endpoint", endpointUri);

            // Periodic keep-alive comments to prevent proxy / Cloudflare timeouts
            keepAliveInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": keep-alive\n\n"));
                } catch {
                    closeConnection();
                    removeSseClient(mcpSessionId);
                }
            }, 20000);
        },
        cancel() {
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            removeSseClient(mcpSessionId);
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            ...CORS_HEADERS
        }
    });
}

/**
 * POST /mcp?key=YOUR_API_KEY
 * - Streamable HTTP / Direct JSON-RPC execution (used by modern MCP clients that send direct POST requests)
 */
export async function POST(request: NextRequest) {
    const authResult = await validateMcpAuth(request);

    if (!authResult) {
        return NextResponse.json(
            {
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Unauthorized: Invalid or missing API key."
                },
                id: null
            },
            { status: 401, headers: CORS_HEADERS }
        );
    }

    try {
        const body = await request.json();

        // Handle single request or batch requests
        if (Array.isArray(body)) {
            const responses = await Promise.all(
                body.map(req => processJsonRpcRequest(req, authResult.user))
            );
            return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
        }

        const response = await processJsonRpcRequest(body, authResult.user);
        if (!response) {
            // Notification has no response
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        return NextResponse.json(response, { headers: CORS_HEADERS });
    } catch (err: any) {
        return NextResponse.json(
            {
                jsonrpc: "2.0",
                error: {
                    code: -32700,
                    message: `Parse error: ${err?.message || "Invalid JSON"}`
                },
                id: null
            },
            { status: 400, headers: CORS_HEADERS }
        );
    }
}
