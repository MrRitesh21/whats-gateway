import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { testAccountConnection } from "@/lib/ai-gateway/gateway";
import { getAIGatewayData } from "@/lib/ai-gateway/storage";
import type { AIAccount } from "@/lib/ai-gateway/types";

// ─── POST /api/ai-gateway/test-account ────────────────────────────────────────
// Body:
//   accountId?: string (test saved account)
//   account?: AIAccount (test ad-hoc before saving)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        let targetAccount: AIAccount | null = null;

        if (body.accountId) {
            const data = await getAIGatewayData();
            targetAccount = data.accounts.find((a) => a.id === body.accountId) || null;
            if (!targetAccount) {
                return NextResponse.json({ status: false, message: "Account not found" }, { status: 404 });
            }
        } else if (body.account) {
            const acc = body.account;
            // If API key is masked and account has an ID, look up the stored key
            let finalKey = acc.apiKey?.trim() || "";
            if (acc.id && (finalKey.includes("...") || finalKey === "********" || !finalKey)) {
                const data = await getAIGatewayData();
                const existing = data.accounts.find((a) => a.id === acc.id);
                if (existing) finalKey = existing.apiKey;
            }

            targetAccount = {
                id: acc.id || "test",
                name: acc.name || "Test Account",
                provider: acc.provider,
                apiKey: finalKey,
                baseUrl: acc.baseUrl?.trim() || undefined,
                model: acc.model?.trim() || "",
                priority: 1,
                weight: 1,
                isActive: true,
                stats: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0 },
            };
        }

        if (!targetAccount) {
            return NextResponse.json({ status: false, message: "No account details provided" }, { status: 400 });
        }

        const result = await testAccountConnection(targetAccount);
        return NextResponse.json({
            status: result.success,
            message: result.message,
            latencyMs: result.latencyMs,
        });
    } catch (e: any) {
        console.error("AI Gateway Test Account error", e);
        return NextResponse.json({
            status: false,
            message: e.message || "Failed to test account",
        }, { status: 500 });
    }
}
