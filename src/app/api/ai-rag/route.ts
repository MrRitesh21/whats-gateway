import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { executeSmartChat } from "@/lib/ai-gateway/gateway";
import { executeProviderCall } from "@/lib/ai-gateway/providers";
import type { AIAccount, ChatMessage } from "@/lib/ai-gateway/types";

// ============================================================
// POST /api/ai-rag
// Enhanced with Smart AI Gateway & Multi-Provider Failover:
// If explicit apiKey & provider are provided, calls that provider.
// Otherwise, routes smartly through the AI Gateway's active accounts
// with automatic failover, load balancing, and Knowledge Base RAG.
// ============================================================

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            provider,
            apiKey = "",
            model = "",
            ollamaUrl = "",
            systemPrompt,
            question = "",
            documents = "",
            useRAG = true,
        } = body;

        if (!question || typeof question !== "string" || !question.trim()) {
            return NextResponse.json({ status: false, message: "Question cannot be empty" }, { status: 400 });
        }

        // 1. If user provided an ad-hoc direct API key, execute directly using the universal provider caller
        if (apiKey && provider) {
            const adHocAccount: AIAccount = {
                id: "adhoc",
                name: "Ad-hoc Provider",
                provider: provider,
                apiKey: apiKey.trim(),
                baseUrl: provider === "ollama" ? ollamaUrl : undefined,
                model: model || (provider === "openai" ? "gpt-4o-mini" : "gemini-2.0-flash"),
                priority: 1,
                weight: 1,
                isActive: true,
                stats: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0 },
            };

            const contextBlock = documents.trim()
                ? `\n\n--- KNOWLEDGE BASE ---\n${documents.trim()}\n--- END KNOWLEDGE BASE ---\n`
                : "";

            const defaultPrompt = "You are a helpful customer support assistant. Answer questions based on the provided knowledge base.";
            const fullSystem = (systemPrompt || defaultPrompt) + contextBlock;

            const messages: ChatMessage[] = [
                { role: "system", content: fullSystem },
                { role: "user", content: question.trim() },
            ];

            const result = await executeProviderCall({
                account: adHocAccount,
                messages,
            });

            return NextResponse.json({
                status: true,
                answer: result.text,
                provider,
                model: adHocAccount.model,
            });
        }

        // 2. Otherwise, route through the Smart AI Gateway with multi-provider, multi-account failover & RAG!
        const gatewayResult = await executeSmartChat({
            question: question.trim(),
            customSystemPrompt: systemPrompt,
            useRAG,
        });

        return NextResponse.json({
            status: true,
            answer: gatewayResult.answer,
            provider: gatewayResult.accountUsed.provider,
            model: gatewayResult.accountUsed.model,
            accountName: gatewayResult.accountUsed.name,
            latencyMs: gatewayResult.latencyMs,
            retrievedChunks: gatewayResult.retrievedChunks,
        });
    } catch (e: any) {
        console.error("AI RAG error", e);
        return NextResponse.json({ status: false, message: e.message || "AI request failed" }, { status: 500 });
    }
}
