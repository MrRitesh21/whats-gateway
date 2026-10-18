import fs from "node:fs/promises";
import path from "node:path";
import type { AIGatewayStoreData, AIAccount, GatewayConfig, KnowledgeDocument, RAGConfig } from "./types";
import { logger } from "@/lib/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "ai-gateway-config.json");

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
            content: `WebotApp WhatsApp Gateway provides cloud-based WhatsApp API, automation, multi-device management, broadcasting, and AI chatbots.
Operating Hours: Monday to Friday from 09:00 AM to 06:00 PM IST.
Support Email: support@webotapp.com
Website: https://webotapp.com
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

import { prisma } from "@/lib/prisma";

let inMemoryCache: AIGatewayStoreData | null = null;
let lastReadTime = 0;
const CACHE_TTL = 3000; // 3 seconds

export async function getAIGatewayData(): Promise<AIGatewayStoreData> {
    const now = Date.now();
    if (inMemoryCache && now - lastReadTime < CACHE_TTL) {
        return inMemoryCache;
    }

    try {
        // 1. Try reading from PostgreSQL SystemConfig (persistent across redeploys)
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: "default" },
            select: { aiGatewayConfig: true },
        }).catch(() => null);

        if (cfg?.aiGatewayConfig && typeof cfg.aiGatewayConfig === "object") {
            const parsed = cfg.aiGatewayConfig as any;
            inMemoryCache = {
                accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_CONFIG.accounts,
                gatewayConfig: { ...DEFAULT_CONFIG.gatewayConfig, ...(parsed.gatewayConfig || {}) },
                documents: Array.isArray(parsed.documents) ? parsed.documents : DEFAULT_CONFIG.documents,
                ragConfig: { ...DEFAULT_CONFIG.ragConfig, ...(parsed.ragConfig || {}) },
            };
            lastReadTime = now;
            // Mirror to local disk in background for resilience
            fs.mkdir(DATA_DIR, { recursive: true })
                .then(() => fs.writeFile(CONFIG_FILE, JSON.stringify(inMemoryCache, null, 2), "utf-8"))
                .catch(() => {});
            return inMemoryCache;
        }

        // 2. Fallback to local file if DB doesn't have it yet
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        inMemoryCache = {
            accounts: Array.isArray(parsed.accounts) ? parsed.accounts : DEFAULT_CONFIG.accounts,
            gatewayConfig: { ...DEFAULT_CONFIG.gatewayConfig, ...(parsed.gatewayConfig || {}) },
            documents: Array.isArray(parsed.documents) ? parsed.documents : DEFAULT_CONFIG.documents,
            ragConfig: { ...DEFAULT_CONFIG.ragConfig, ...(parsed.ragConfig || {}) },
        };
        lastReadTime = now;

        // Seed into PostgreSQL so next redeploy has it
        await prisma.systemConfig.upsert({
            where: { id: "default" },
            update: { aiGatewayConfig: inMemoryCache as any },
            create: { id: "default", aiGatewayConfig: inMemoryCache as any },
        }).catch(() => null);

        return inMemoryCache;
    } catch {
        // If neither exists, use default config and persist to DB
        inMemoryCache = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        lastReadTime = now;
        saveAIGatewayData(DEFAULT_CONFIG).catch((err) => {
            logger.error("AIGateway", "Failed to write initial config file", err);
        });
        return inMemoryCache!;
    }
}

export async function saveAIGatewayData(data: AIGatewayStoreData): Promise<void> {
    inMemoryCache = data;
    lastReadTime = Date.now();

    // 1. Persist to PostgreSQL SystemConfig
    try {
        await prisma.systemConfig.upsert({
            where: { id: "default" },
            update: { aiGatewayConfig: data as any },
            create: { id: "default", aiGatewayConfig: data as any },
        });
    } catch (err) {
        logger.error("AIGateway", "Failed to persist aiGatewayConfig to PostgreSQL", err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${CONFIG_FILE}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tempFile, CONFIG_FILE);
    } catch {
        // Ephemeral disk write error is non-fatal since DB succeeded
    }
}

/** Update specific account */
export async function saveAccount(account: AIAccount): Promise<AIAccount> {
    const data = await getAIGatewayData();
    const idx = data.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
        data.accounts[idx] = { ...data.accounts[idx], ...account };
    } else {
        data.accounts.push(account);
    }
    await saveAIGatewayData(data);
    return account;
}

/** Delete account */
export async function deleteAccount(id: string): Promise<boolean> {
    const data = await getAIGatewayData();
    const prevLen = data.accounts.length;
    data.accounts = data.accounts.filter((a) => a.id !== id);
    if (data.accounts.length !== prevLen) {
        await saveAIGatewayData(data);
        return true;
    }
    return false;
}

/** Update gateway configuration */
export async function updateGatewayConfig(config: Partial<GatewayConfig>): Promise<GatewayConfig> {
    const data = await getAIGatewayData();
    data.gatewayConfig = { ...data.gatewayConfig, ...config };
    await saveAIGatewayData(data);
    return data.gatewayConfig;
}

/** Update RAG configuration */
export async function updateRAGConfig(config: Partial<RAGConfig>): Promise<RAGConfig> {
    const data = await getAIGatewayData();
    data.ragConfig = { ...data.ragConfig, ...config };
    await saveAIGatewayData(data);
    return data.ragConfig;
}

/** Save or update knowledge document */
export async function saveDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const data = await getAIGatewayData();
    const idx = data.documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
        data.documents[idx] = { ...data.documents[idx], ...doc, updatedAt: new Date().toISOString() };
    } else {
        data.documents.push(doc);
    }
    await saveAIGatewayData(data);
    return doc;
}

/** Delete knowledge document */
export async function deleteDocument(id: string): Promise<boolean> {
    const data = await getAIGatewayData();
    const prevLen = data.documents.length;
    data.documents = data.documents.filter((d) => d.id !== id);
    if (data.documents.length !== prevLen) {
        await saveAIGatewayData(data);
        return true;
    }
    return false;
}
