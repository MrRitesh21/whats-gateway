import { NextRequest, NextResponse } from "next/server";
import { validateMcpAuth, getSseClient, processJsonRpcRequest } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key"
};

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
}

/**
 * POST /mcp/messages?sessionId=...&key=...
 * - Receives JSON-RPC messages from Claude/MCP clients and streams responses back over the active SSE stream.
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

    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    const sseClient = sessionId ? getSseClient(sessionId) : undefined;

    try {
        const body = await request.json();

        // Helper to process and dispatch a single JSON-RPC message
        const handleOne = async (rpc: any) => {
            const response = await processJsonRpcRequest(rpc, authResult.user);

            // If an active SSE client is listening, forward the response over the SSE stream
            if (response && sseClient) {
                sseClient.send("message", response);
            }

            return response;
        };

        if (Array.isArray(body)) {
            const responses = await Promise.all(body.map(handleOne));
            return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
        }

        const response = await handleOne(body);

        if (!response) {
            // Notification accepted
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // Return the response directly in the POST body as well for HTTP-direct transports
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
