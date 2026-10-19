import fs from "node:fs/promises";
import path from "node:path";
import type { AIGatewayStoreData, AIAccount, GatewayConfig, KnowledgeDocument, RAGConfig } from "./types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, "ai-gateway-config.json");

function normalizeKey(userId?: string): string {
    if (!userId || typeof userId !== "string") return "default";
    const trimmed = userId.trim();
    if (!trimmed || trimmed === "default") return "default";
    return trimmed;
}

function getCacheKey(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? "default" : `user_${key}`;
}

function getConfigFile(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? DEFAULT_CONFIG_FILE : path.join(DATA_DIR, `ai-gateway-config-${key}.json`);
}

function getRecordId(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? "default" : `user_${key}`;
}

const DEFAULT_CONFIG: AIGatewayStoreData = {
    accounts: [],
    gatewayConfig: {
        routingStrategy: "priority_fallback",
        defaultSystemPrompt: "You are an intelligent, polite, and helpful AI assistant for WhatsApp. Keep your answers concise, accurate, and easy to read on mobile devices.",
        temperature: 0.7,
        maxTokens: 1024,
        timeoutMs: 25000,
    },
    documents: [
        {
            id: "doc-sample-1",
            title: "General Service Information & FAQ",
            category: "Customer Support",
            content: `WAFlow WhatsApp Gateway provides cloud-based WhatsApp API, automation, multi-device management, broadcasting, and AI chatbots.
Operating Hours: Monday to Friday from 09:00 AM to 06:00 PM IST.
Support Email: support@WAFlow.com
Website: https://WAFlow.com
Features:
- Multi-session WhatsApp web management
- Bulk messaging with Anti-Ban and multi-session rotation
- Auto-reply with keyword matching & smart AI RAG
- Sticker generation and media converter
- REST API & Webhooks for external integration`,
            tags: ["faq", "support", "features"],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
    ],
    ragConfig: {
        topK: 4,
        minScore: 0.15,
        chunkSize: 450,
        chunkOverlap: 60,
        enableWhatsAppAutoReply: false,
        whatsappSessions: [],
        systemInstructions: "You are the official AI assistant. Answer the user query using ONLY the provided Knowledge Base context when relevant. If the context does not contain the answer, politely mention that you do not have that specific detail and offer to connect with human support.",
        fallbackMessage: "I'm sorry, I couldn't find an answer to that in our knowledge base. Please contact our support team for further assistance.",
    },
};

interface CacheEntry {
    data: AIGatewayStoreData;
    lastReadTime: number;
}
const inMemoryCaches = new Map<string, CacheEntry>();
const CACHE_TTL = 3000; // 3 seconds

export async function getAIGatewayData(userId?: string): Promise<AIGatewayStoreData> {
    const key = getCacheKey(userId);
    const now = Date.now();
    const cached = inMemoryCaches.get(key);
    if (cached && now - cached.lastReadTime < CACHE_TTL) {
        return cached.data;
    }

    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    try {
        // 1. Try reading from PostgreSQL SystemConfig
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: recordId },
            select: { aiGatewayConfig: true },
        }).catch(() => null);

        if (cfg?.aiGatewayConfig && typeof cfg.aiGatewayConfig === "object") {
            const parsed = cfg.aiGatewayConfig as any;
            const data: AIGatewayStoreData = {
                accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_CONFIG.accounts,
                gatewayConfig: { ...DEFAULT_CONFIG.gatewayConfig, ...(parsed.gatewayConfig || {}) },
                documents: Array.isArray(parsed.documents) ? parsed.documents : DEFAULT_CONFIG.documents,
                ragConfig: { ...DEFAULT_CONFIG.ragConfig, ...(parsed.ragConfig || {}) },
            };
            inMemoryCaches.set(key, { data, lastReadTime: now });
            // Mirror to local disk in background for resilience
            fs.mkdir(DATA_DIR, { recursive: true })
                .then(() => fs.writeFile(configFile, JSON.stringify(data, null, 2), "utf-8"))
                .catch(() => {});
            return data;
        }

        // 2. Fallback to local user file if DB doesn't have it yet
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(configFile, "utf-8");
        const parsed = JSON.parse(raw);
        const data: AIGatewayStoreData = {
            accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_CONFIG.accounts,
            gatewayConfig: { ...DEFAULT_CONFIG.gatewayConfig, ...(parsed.gatewayConfig || {}) },
            documents: Array.isArray(parsed.documents) ? parsed.documents : DEFAULT_CONFIG.documents,
            ragConfig: { ...DEFAULT_CONFIG.ragConfig, ...(parsed.ragConfig || {}) },
        };
        inMemoryCaches.set(key, { data, lastReadTime: now });

        // Seed into PostgreSQL so next redeploy has it
        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: { aiGatewayConfig: data as any },
            create: { id: recordId, aiGatewayConfig: data as any },
        }).catch(() => null);

        return data;
    } catch {
        // If neither exists for this user: inherit from default configuration so they have working template
        let baseConfig = DEFAULT_CONFIG;
        if (key !== "default") {
            try {
                baseConfig = await getAIGatewayData("default");
            } catch {
                baseConfig = DEFAULT_CONFIG;
            }
        }

        const fresh: AIGatewayStoreData = JSON.parse(JSON.stringify(baseConfig));
        inMemoryCaches.set(key, { data: fresh, lastReadTime: now });

        if (key === "default") {
            saveAIGatewayData(DEFAULT_CONFIG, "default").catch((err) => {
                logger.error("AIGateway", "Failed to write initial default config", err);
            });
        }
        return fresh;
    }
}

export async function saveAIGatewayData(data: AIGatewayStoreData, userId?: string): Promise<void> {
    const key = getCacheKey(userId);
    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    inMemoryCaches.set(key, { data, lastReadTime: Date.now() });

    // 1. Persist to PostgreSQL SystemConfig
    try {
        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: { aiGatewayConfig: data as any },
            create: { id: recordId, aiGatewayConfig: data as any },
        });
    } catch (err) {
        logger.error("AIGateway", `Failed to persist aiGatewayConfig for ${key} to PostgreSQL`, err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${configFile}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tempFile, configFile);
    } catch {
        // Ephemeral disk write error is non-fatal since DB succeeded
    }
}

/** Update specific account */
export async function saveAccount(account: AIAccount, userId?: string): Promise<AIAccount> {
    const data = await getAIGatewayData(userId);
    const idx = data.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
        data.accounts[idx] = { ...data.accounts[idx], ...account };
    } else {
        data.accounts.push(account);
    }
    await saveAIGatewayData(data, userId);
    return account;
}

/** Delete account */
export async function deleteAccount(id: string, userId?: string): Promise<boolean> {
    const data = await getAIGatewayData(userId);
    const prevLen = data.accounts.length;
    data.accounts = data.accounts.filter((a) => a.id !== id);
    if (data.accounts.length !== prevLen) {
        await saveAIGatewayData(data, userId);
        return true;
    }
    return false;
}

/** Update gateway configuration */
export async function updateGatewayConfig(config: Partial<GatewayConfig>, userId?: string): Promise<GatewayConfig> {
    const data = await getAIGatewayData(userId);
    data.gatewayConfig = { ...data.gatewayConfig, ...config };
    await saveAIGatewayData(data, userId);
    return data.gatewayConfig;
}

/** Update RAG configuration */
export async function updateRAGConfig(config: Partial<RAGConfig>, userId?: string): Promise<RAGConfig> {
    const data = await getAIGatewayData(userId);
    data.ragConfig = { ...data.ragConfig, ...config };
    await saveAIGatewayData(data, userId);
    return data.ragConfig;
}

/** Save or update knowledge document */
export async function saveDocument(doc: KnowledgeDocument, userId?: string): Promise<KnowledgeDocument> {
    const data = await getAIGatewayData(userId);
    const idx = data.documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
        data.documents[idx] = { ...data.documents[idx], ...doc, updatedAt: new Date().toISOString() };
    } else {
        data.documents.push(doc);
    }
    await saveAIGatewayData(data, userId);
    return doc;
}

/** Delete knowledge document */
export async function deleteDocument(id: string, userId?: string): Promise<boolean> {
    const data = await getAIGatewayData(userId);
    const prevLen = data.documents.length;
    data.documents = data.documents.filter((d) => d.id !== id);
    if (data.documents.length !== prevLen) {
        await saveAIGatewayData(data, userId);
        return true;
    }
    return false;
}