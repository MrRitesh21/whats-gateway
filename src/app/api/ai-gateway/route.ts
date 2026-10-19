import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
    getAIGatewayData,
    saveAccount,
    deleteAccount,
    updateGatewayConfig,
    updateRAGConfig,
} from "@/lib/ai-gateway/storage";
import type { AIAccount } from "@/lib/ai-gateway/types";

function maskApiKey(key: string): string {
    if (!key) return "";
    if (key.length <= 8) return "********";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// ─── GET: Fetch AI Gateway configuration, accounts, and summary ───────────────
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const data = await getAIGatewayData(user.id);

        // Mask API keys for security in UI responses
        const safeAccounts = data.accounts.map((acc) => ({
            ...acc,
            apiKey: maskApiKey(acc.apiKey),
            hasApiKey: Boolean(acc.apiKey && acc.apiKey.length > 0),
        }));

        return NextResponse.json({
            status: true,
            data: {
                accounts: safeAccounts,
                gatewayConfig: data.gatewayConfig,
                ragConfig: data.ragConfig,
                documentCount: data.documents.length,
            },
        });
    } catch (e: any) {
        console.error("AI Gateway GET error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to fetch AI Gateway data" }, { status: 500 });
    }
}

// ─── POST: Create/update account or settings ───────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { action = "save_account" } = body;

        if (action === "update_gateway_config") {
            const updated = await updateGatewayConfig(body.config || {}, user.id);
            return NextResponse.json({ status: true, message: "Gateway settings updated", data: updated });
        }

        if (action === "update_rag_config") {
            const updated = await updateRAGConfig(body.config || {}, user.id);
            return NextResponse.json({ status: true, message: "RAG settings updated", data: updated });
        }

        if (action === "save_account") {
            const accData = body.account;
            if (!accData || !accData.name || !accData.provider) {
                return NextResponse.json({ status: false, message: "Account name and provider are required" }, { status: 400 });
            }

            const currentData = await getAIGatewayData(user.id);
            const existing = currentData.accounts.find((a) => a.id === accData.id);

            // Handle API key: if user left it masked or blank during update, keep existing key
            let finalApiKey = accData.apiKey?.trim() || "";
            if ((!finalApiKey || finalApiKey.includes("...") || finalApiKey === "********") && existing) {
                finalApiKey = existing.apiKey;
            }

            if (!finalApiKey && accData.provider !== "ollama") {
                return NextResponse.json({ status: false, message: "API Key is required for this provider" }, { status: 400 });
            }

            const accountToSave: AIAccount = {
                id: accData.id || `acc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name: accData.name.trim(),
                provider: accData.provider,
                apiKey: finalApiKey,
                baseUrl: accData.baseUrl?.trim() || undefined,
                model: accData.model?.trim() || "",
                priority: Number(accData.priority) || 1,
                weight: Number(accData.weight) || 1,
                isActive: accData.isActive !== false,
                stats: existing?.stats || {
                    totalCalls: 0,
                    successfulCalls: 0,
                    failedCalls: 0,
                    avgLatencyMs: 0,
                },
            };

            await saveAccount(accountToSave, user.id);
            return NextResponse.json({
                status: true,
                message: "Account saved successfully",
                data: { ...accountToSave, apiKey: maskApiKey(accountToSave.apiKey) },
            });
        }

        return NextResponse.json({ status: false, message: `Unknown action: ${action}` }, { status: 400 });
    } catch (e: any) {
        console.error("AI Gateway POST error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to process request" }, { status: 500 });
    }
}

// ─── DELETE: Remove an account ────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ status: false, message: "Account ID is required" }, { status: 400 });
        }

        const ok = await deleteAccount(id, user.id);
        if (!ok) {
            return NextResponse.json({ status: false, message: "Account not found" }, { status: 404 });
        }

        return NextResponse.json({ status: true, message: "Account removed successfully" });
    } catch (e: any) {
        console.error("AI Gateway DELETE error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to delete account" }, { status: 500 });
    }
}
