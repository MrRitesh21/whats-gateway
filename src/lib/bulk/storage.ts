import fs from "node:fs/promises";
import path from "node:path";
import type { BulkCampaignRecord, BulkHistoryStore } from "./types";
import { logger } from "@/lib/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const BULK_HISTORY_FILE = path.join(DATA_DIR, "bulk-campaigns.json");
const MAX_STORED_CAMPAIGNS = 100;

let inMemoryStore: BulkHistoryStore | null = null;
let lastReadTime = 0;
const CACHE_TTL = 3000;

export async function getBulkHistory(): Promise<BulkHistoryStore> {
    const now = Date.now();
    if (inMemoryStore && now - lastReadTime < CACHE_TTL) {
        return inMemoryStore;
    }

    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(BULK_HISTORY_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        inMemoryStore = {
            campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
        };
        lastReadTime = now;
        return inMemoryStore;
    } catch {
        inMemoryStore = { campaigns: [] };
        try {
            await saveBulkHistory(inMemoryStore);
        } catch (e) {
            logger.error("BULK", "Failed to initialize bulk-campaigns.json", e);
        }
        lastReadTime = now;
        return inMemoryStore;
    }
}

export async function saveBulkHistory(store: BulkHistoryStore): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // Cap stored campaigns to MAX_STORED_CAMPAIGNS
    if (store.campaigns.length > MAX_STORED_CAMPAIGNS) {
        store.campaigns = store.campaigns.slice(0, MAX_STORED_CAMPAIGNS);
    }

    const tempFile = `${BULK_HISTORY_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), "utf-8");
    await fs.rename(tempFile, BULK_HISTORY_FILE);
    inMemoryStore = store;
    lastReadTime = Date.now();
}

/**
 * Get all past campaigns sorted by start date descending
 */
export async function getBulkCampaigns(activeIds: Set<string> = new Set()): Promise<BulkCampaignRecord[]> {
    const store = await getBulkHistory();
    let modified = false;

    // Check for any campaign left in "running" or "reconnecting" that is not currently running
    for (const c of store.campaigns) {
        if ((c.status === "running" || c.status === "reconnecting") && !activeIds.has(c.broadcastId)) {
            c.status = "paused";
            c.reconnectMessage = "Campaign paused after server restart. Ready to resume.";
            modified = true;
        }
    }

    if (modified) {
        await saveBulkHistory(store);
    }

    return store.campaigns.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/**
 * Get a single campaign record by broadcastId
 */
export async function getBulkCampaign(broadcastId: string): Promise<BulkCampaignRecord | null> {
    const store = await getBulkHistory();
    return store.campaigns.find((c) => c.broadcastId === broadcastId || c.id === broadcastId) || null;
}

/**
 * Upsert a campaign record into persistent history
 */
export async function saveBulkCampaign(campaign: BulkCampaignRecord): Promise<void> {
    const store = await getBulkHistory();
    const idx = store.campaigns.findIndex((c) => c.broadcastId === campaign.broadcastId);

    if (idx >= 0) {
        store.campaigns[idx] = { ...store.campaigns[idx], ...campaign };
    } else {
        store.campaigns.unshift(campaign);
    }

    await saveBulkHistory(store);
}

/**
 * Delete a campaign from history
 */
export async function deleteBulkCampaign(broadcastId: string): Promise<boolean> {
    const store = await getBulkHistory();
    const prevLen = store.campaigns.length;
    store.campaigns = store.campaigns.filter((c) => c.broadcastId !== broadcastId && c.id !== broadcastId);
    if (store.campaigns.length !== prevLen) {
        await saveBulkHistory(store);
        return true;
    }
    return false;
}

/**
 * Clear all campaign history
 */
export async function clearBulkHistory(): Promise<void> {
    await saveBulkHistory({ campaigns: [] });
}
