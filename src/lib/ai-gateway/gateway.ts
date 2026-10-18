import type { AIAccount, ChatMessage, GatewayExecutionResult } from "./types";
import { getAIGatewayData, saveAIGatewayData } from "./storage";
import { executeProviderCall } from "./providers";
import { searchKnowledgeBase, buildRAGContextBlock } from "./rag";
import { logger } from "@/lib/logger";

let roundRobinCounter = 0;

/**
 * Filter and sort accounts based on active status, rate limit cooldowns, and strategy
 */
function getEligibleAccounts(accounts: AIAccount[], strategy: string): AIAccount[] {
    const now = Date.now();
    const active = accounts.filter((a) => {
        if (!a.isActive) return false;
        if (a.rateLimitCooldownUntil && a.rateLimitCooldownUntil > now) return false;
        return true;
    });

    if (active.length === 0) return [];

    switch (strategy) {
        case "round_robin": {
            const len = active.length;
            const start = roundRobinCounter % len;
            roundRobinCounter++;
            return [...active.slice(start), ...active.slice(0, start)];
        }
        case "least_latency": {
            return [...active].sort((a, b) => {
                const latA = a.stats.avgLatencyMs || 9999;
                const latB = b.stats.avgLatencyMs || 9999;
                return latA - latB;
            });
        }
        case "priority_fallback":
        default: {
            return [...active].sort((a, b) => (a.priority || 1) - (b.priority || 1));
        }
    }
}

/**
 * Test a single account connection
 */
export async function testAccountConnection(account: AIAccount): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
}> {
    const start = Date.now();
    try {
        const result = await executeProviderCall({
            account,
            messages: [
                { role: "system", content: "You are a test ping agent. Answer with exactly: 'OK'" },
                { role: "user", content: "Ping" },
            ],
            maxTokens: 10,
            timeoutMs: 15000,
        });
        const latencyMs = Date.now() - start;
        return {
            success: true,
            message: `Connected successfully! Response: "${result.text}" (${latencyMs}ms)`,
            latencyMs,
        };
    } catch (err: any) {
        const latencyMs = Date.now() - start;
        return {
            success: false,
            message: err.message || "Connection failed",
            latencyMs,
        };
    }
}

export interface SmartChatOptions {
    question: string;
    customSystemPrompt?: string;
    specificAccountId?: string;
    useRAG?: boolean;
    chatHistory?: ChatMessage[];
}

/**
 * Primary Smart AI Gateway execution function:
 * 1. Searches knowledge base (if useRAG is true)
 * 2. Compiles contextualized prompt
 * 3. Dispatches across accounts with smart failover and cooldown recovery
 */
export async function executeSmartChat(options: SmartChatOptions): Promise<GatewayExecutionResult> {
    const { question, customSystemPrompt, specificAccountId, useRAG = true, chatHistory = [] } = options;
    const store = await getAIGatewayData();

    // 1. RAG Retrieval
    let retrievedChunks: GatewayExecutionResult["retrievedChunks"] = [];
    let ragContextBlock = "";

    if (useRAG) {
        const scored = await searchKnowledgeBase(question);
        if (scored.length > 0) {
            retrievedChunks = scored.map((s) => ({
                docTitle: s.chunk.docTitle,
                chunkIndex: s.chunk.chunkIndex,
                score: Math.round(s.score * 100) / 100,
                text: s.chunk.text,
            }));
            ragContextBlock = buildRAGContextBlock(scored);
        }
    }

    // 2. Build system prompt
    const baseSystem = customSystemPrompt || store.ragConfig.systemInstructions || store.gatewayConfig.defaultSystemPrompt;
    const fullSystemPrompt = ragContextBlock ? `${baseSystem}\n\n${ragContextBlock}` : baseSystem;

    // 3. Compile chat messages
    const messages: ChatMessage[] = [
        { role: "system", content: fullSystemPrompt },
        ...chatHistory,
        { role: "user", content: question },
    ];

    // 4. Select accounts
    let candidateAccounts: AIAccount[] = [];
    if (specificAccountId) {
        const target = store.accounts.find((a) => a.id === specificAccountId);
        if (target) candidateAccounts = [target];
    }

    if (candidateAccounts.length === 0) {
        candidateAccounts = getEligibleAccounts(store.accounts, store.gatewayConfig.routingStrategy);
    }

    if (candidateAccounts.length === 0) {
        throw new Error(
            "No active AI accounts available in AI Gateway. Please configure at least one active API key in Dashboard > AI Gateway."
        );
    }

    // 5. Failover loop
    let lastError: Error | null = null;
    let attempts = 0;

    for (const account of candidateAccounts) {
        attempts++;
        const startTime = Date.now();

        try {
            logger.info(
                "AIGateway",
                `Attempt ${attempts}: Calling ${account.name} (${account.provider}:${account.model})...`
            );

            const result = await executeProviderCall({
                account,
                messages,
                temperature: store.gatewayConfig.temperature,
                maxTokens: store.gatewayConfig.maxTokens,
                timeoutMs: store.gatewayConfig.timeoutMs,
            });

            const latencyMs = Date.now() - startTime;

            // Update account statistics
            account.stats.totalCalls++;
            account.stats.successfulCalls++;
            account.stats.avgLatencyMs = Math.round(
                (account.stats.avgLatencyMs * (account.stats.successfulCalls - 1) + latencyMs) /
                    account.stats.successfulCalls
            );
            account.lastUsedAt = new Date().toISOString();
            account.lastError = undefined;

            // Save updated stats asynchronously
            saveAIGatewayData(store).catch((err) =>
                logger.error("AIGateway", "Failed to persist account stats", err)
            );

            return {
                answer: result.text,
                accountUsed: {
                    id: account.id,
                    name: account.name,
                    provider: account.provider,
                    model: account.model,
                },
                latencyMs,
                attempts,
                retrievedChunks,
            };
        } catch (err: any) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.message || "Unknown provider error";
            logger.warn("AIGateway", `Account ${account.name} failed (${errMsg}). Failing over...`);

            // Check if rate limited (429 or quota exceeded) -> set 60s cooldown
            const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit");
            if (isRateLimit) {
                account.rateLimitCooldownUntil = Date.now() + 60_000;
                logger.warn("AIGateway", `Account ${account.name} set to rate-limit cooldown for 60s`);
            }

            account.stats.totalCalls++;
            account.stats.failedCalls++;
            account.lastError = errMsg;
            lastError = err;

            // Continue loop to try next account!
        }
    }

    // If all candidates failed, persist stats and throw
    saveAIGatewayData(store).catch(() => {});
    throw new Error(
        `All ${candidateAccounts.length} AI accounts failed. Last error: ${lastError?.message || "Unknown error"}`
    );
}
