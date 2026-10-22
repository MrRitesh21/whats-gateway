export type AIProvider =
    | "openai"
    | "gemini"
    | "anthropic"
    | "groq"
    | "deepseek"
    | "ollama"
    | "openrouter"
    | "custom";

export interface AIAccount {
    id: string;
    name: string;
    provider: AIProvider;
    apiKey: string;
    baseUrl?: string;
    model: string;
    priority: number; // 1 = highest priority (fallback chain)
    weight: number;   // for round-robin / load balancing (default: 1)
    isActive: boolean;
    rateLimitCooldownUntil?: number; // epoch ms when cooldown expires
    lastError?: string;
    lastTestedAt?: string;
    lastUsedAt?: string;
    stats: {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        totalTokens?: number;
        avgLatencyMs: number;
    };
}

export type RoutingStrategy = "priority_fallback" | "round_robin" | "least_latency";

export interface GatewayConfig {
    routingStrategy: RoutingStrategy;
    defaultSystemPrompt: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
}

export interface KnowledgeDocument {
    id: string;
    title: string;
    category: string;
    content: string;
    tags: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RAGChunk {
    docId: string;
    docTitle: string;
    chunkIndex: number;
    text: string;
    keywords: string[];
}

export interface RAGConfig {
    topK: number;
    minScore: number;
    chunkSize: number;
    chunkOverlap: number;
    enableWhatsAppAutoReply: boolean;
    whatsappSessions: string[]; // sessionIds enabled for RAG auto-reply
    systemInstructions: string;
    sessionSystemInstructions?: Record<string, string>; // Per-WhatsApp-session persona overrides
    fallbackMessage: string;
}

export interface AIGatewayStoreData {
    accounts: AIAccount[];
    gatewayConfig: GatewayConfig;
    documents: KnowledgeDocument[];
    ragConfig: RAGConfig;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface GatewayExecutionResult {
    answer: string;
    accountUsed: {
        id: string;
        name: string;
        provider: AIProvider;
        model: string;
    };
    latencyMs: number;
    attempts: number;
    retrievedChunks?: {
        docTitle: string;
        chunkIndex: number;
        score: number;
        text: string;
    }[];
}
