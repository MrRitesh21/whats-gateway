import fs from "node:fs/promises";
import path from "node:path";
import type {
    CRMStoreData,
    Lead,
    LeadStage,
    LeadPriority,
    LeadActivity,
    CSVImportResult,
    WhatsAppSyncResult,
} from "./types";
import { parseLeadsFromCSV } from "./csv-parser";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_CRM_FILE = path.join(DATA_DIR, "crm-leads.json");

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
    return key === "default" ? DEFAULT_CRM_FILE : path.join(DATA_DIR, `crm-leads-${key}.json`);
}

function getRecordId(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? "default" : `user_${key}`;
}

const DEFAULT_CRM_DATA: CRMStoreData = {
    leads: [],
    customStages: [
        { id: "NEW", name: "New Leads", color: "#3B82F6" },
        { id: "CONTACTED", name: "Contacted", color: "#8B5CF6" },
        { id: "INTERESTED", name: "Interested", color: "#06B6D4" },
        { id: "QUALIFIED", name: "Qualified", color: "#F59E0B" },
        { id: "PROPOSAL", name: "Proposal Sent", color: "#EC4899" },
        { id: "WON", name: "Won / Customer", color: "#10B981" },
        { id: "LOST", name: "Lost / Closed", color: "#6B7280" },
    ],
};

interface CacheEntry {
    data: CRMStoreData;
    lastReadTime: number;
}
const inMemoryCaches = new Map<string, CacheEntry>();
const CACHE_TTL = 3000;

export async function getCRMData(userId?: string): Promise<CRMStoreData> {
    const key = getCacheKey(userId);
    const now = Date.now();
    const cached = inMemoryCaches.get(key);
    if (cached && now - cached.lastReadTime < CACHE_TTL) {
        return cached.data;
    }

    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);
    const userKey = normalizeKey(userId);

    try {
        // 1. Read from PostgreSQL SystemConfig (persistent across redeploys)
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: recordId },
            select: { crmData: true },
        }).catch(() => null);

        if (cfg?.crmData && typeof cfg.crmData === "object") {
            const parsed = cfg.crmData as any;
            const leads = Array.isArray(parsed.leads) ? parsed.leads : DEFAULT_CRM_DATA.leads;
            const taggedLeads: Lead[] = key === "default"
                ? leads
                : leads.map((l: Lead) => ({ ...l, userId: l.userId || userKey }));

            const data: CRMStoreData = {
                leads: taggedLeads,
                customStages: Array.isArray(parsed.customStages) ? parsed.customStages : DEFAULT_CRM_DATA.customStages,
            };
            inMemoryCaches.set(key, { data, lastReadTime: now });
            // Mirror to local disk in background
            fs.mkdir(DATA_DIR, { recursive: true })
                .then(() => fs.writeFile(configFile, JSON.stringify(data, null, 2), "utf-8"))
                .catch(() => {});
            return data;
        }

        // 2. Fallback to local file if DB doesn't have it yet
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(configFile, "utf-8");
        const parsed = JSON.parse(raw);
        const leads = Array.isArray(parsed.leads) ? parsed.leads : DEFAULT_CRM_DATA.leads;
        const taggedLeads: Lead[] = key === "default"
            ? leads
            : leads.map((l: Lead) => ({ ...l, userId: l.userId || userKey }));

        const data: CRMStoreData = {
            leads: taggedLeads,
            customStages: Array.isArray(parsed.customStages) ? parsed.customStages : DEFAULT_CRM_DATA.customStages,
        };
        inMemoryCaches.set(key, { data, lastReadTime: now });

        // Seed into PostgreSQL
        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: { crmData: data as any },
            create: { id: recordId, crmData: data as any },
        }).catch(() => null);

        return data;
    } catch {
        // If neither exists for this user:
        // Initial migration for superadmin if legacy default had leads:
        if (key !== "default" && userKey === "cmvdpdy2j00011t8kodp9jhy8") {
            try {
                const defaultData = await getCRMData("default");
                if (defaultData.leads.length > 0) {
                    const migrated: CRMStoreData = {
                        leads: defaultData.leads.map((l) => ({ ...l, userId: userKey })),
                        customStages: defaultData.customStages || DEFAULT_CRM_DATA.customStages,
                    };
                    inMemoryCaches.set(key, { data: migrated, lastReadTime: now });
                    saveCRMData(migrated, userId).catch(() => {});
                    return migrated;
                }
            } catch {}
        }

        // For all other users/tenants: Clean isolated slate with zero cross-tenant leakage!
        const fresh: CRMStoreData = {
            leads: key === "default" ? DEFAULT_CRM_DATA.leads : [],
            customStages: DEFAULT_CRM_DATA.customStages,
        };
        inMemoryCaches.set(key, { data: fresh, lastReadTime: now });

        if (key === "default") {
            saveCRMData(DEFAULT_CRM_DATA, "default").catch((e) => {
                logger.error("CRM", "Failed to create default CRM storage file", e);
            });
        }
        return fresh;
    }
}

export async function saveCRMData(data: CRMStoreData, userId?: string): Promise<void> {
    const key = getCacheKey(userId);
    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    inMemoryCaches.set(key, { data, lastReadTime: Date.now() });

    // 1. Persist to PostgreSQL SystemConfig
    try {
        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: { crmData: data as any },
            create: { id: recordId, crmData: data as any },
        });
    } catch (err) {
        logger.error("CRM", `Failed to persist crmData for ${key} to PostgreSQL`, err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${configFile}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tempFile, configFile);
    } catch {
        // Ephemeral disk write error is non-fatal
    }
}

/**
 * Import leads from a CSV string into the user's isolated CRM store
 */
export async function importLeads(csvText: string, userId?: string): Promise<CSVImportResult> {
    const data = await getCRMData(userId);
    const existingPhoneSet = new Set(data.leads.map((l) => l.formattedPhone));

    const result = parseLeadsFromCSV(csvText, existingPhoneSet);
    const userKey = userId ? normalizeKey(userId) : undefined;
    if (result.leads.length > 0) {
        const taggedLeads = result.leads.map((l) => ({
            ...l,
            userId: userKey,
        }));
        data.leads.unshift(...taggedLeads);
        await saveCRMData(data, userId);
        result.leads = taggedLeads;
    }

    return result;
}

/**
 * Save or update a single lead in user's isolated CRM store
 */
export async function saveLead(lead: Lead, userId?: string): Promise<Lead> {
    const targetUserId = userId || lead.userId;
    const data = await getCRMData(targetUserId);
    if (targetUserId) {
        lead.userId = normalizeKey(targetUserId);
    }
    const idx = data.leads.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
        const existing = data.leads[idx];
        data.leads[idx] = {
            ...existing,
            ...lead,
            userId: lead.userId || existing.userId || (targetUserId ? normalizeKey(targetUserId) : undefined),
            activities: lead.activities || existing.activities || [],
            updatedAt: new Date().toISOString()
        };
    } else {
        if (!lead.activities) {
            lead.activities = [
                {
                    id: `act_${Date.now()}_init`,
                    type: "note",
                    content: "Lead created in CRM",
                    createdAt: new Date().toISOString(),
                }
            ];
        }
        data.leads.unshift(lead);
    }
    await saveCRMData(data, targetUserId);
    return lead;
}

/**
 * Update lead stage with optional activity note
 */
export async function updateLeadStage(id: string, stage: LeadStage, note?: string, userId?: string): Promise<Lead | null> {
    const data = await getCRMData(userId);
    const target = data.leads.find((l) => l.id === id);
    if (!target) return null;

    const oldStage = target.stage;
    target.stage = stage;
    target.updatedAt = new Date().toISOString();
    if (stage === "CONTACTED" && !target.lastContactedAt) {
        target.lastContactedAt = new Date().toISOString();
    }

    if (!target.activities) target.activities = [];
    target.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "stage_change",
        content: `Stage changed: ${oldStage} → ${stage}${note ? ` (${note})` : ""}`,
        createdAt: new Date().toISOString(),
    });

    await saveCRMData(data, userId);
    return target;
}

/**
 * Update lead priority (HOT, WARM, COLD)
 */
export async function updateLeadPriority(id: string, priority: LeadPriority, userId?: string): Promise<Lead | null> {
    const data = await getCRMData(userId);
    const target = data.leads.find((l) => l.id === id);
    if (!target) return null;

    target.priority = priority;
    target.updatedAt = new Date().toISOString();

    if (!target.activities) target.activities = [];
    target.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "note",
        content: `Priority set to ${priority}`,
        createdAt: new Date().toISOString(),
    });

    await saveCRMData(data, userId);
    return target;
}

/**
 * Add an activity / note to lead timeline
 */
export async function addLeadActivity(
    leadId: string,
    activity: Omit<LeadActivity, "id" | "createdAt">,
    userId?: string
): Promise<Lead | null> {
    const data = await getCRMData(userId);
    const target = data.leads.find((l) => l.id === leadId);
    if (!target) return null;

    if (!target.activities) target.activities = [];
    target.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...activity,
        createdAt: new Date().toISOString(),
    });
    target.updatedAt = new Date().toISOString();

    await saveCRMData(data, userId);
    return target;
}

/**
 * Update follow-up reminder date and note
 */
export async function updateLeadFollowUp(
    id: string,
    followUpDate?: string,
    followUpNote?: string,
    userId?: string
): Promise<Lead | null> {
    const data = await getCRMData(userId);
    const target = data.leads.find((l) => l.id === id);
    if (!target) return null;

    target.followUpDate = followUpDate || undefined;
    target.followUpNote = followUpNote || undefined;
    target.updatedAt = new Date().toISOString();

    if (followUpDate) {
        if (!target.activities) target.activities = [];
        target.activities.unshift({
            id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: "followup",
            content: `Follow-up scheduled for ${followUpDate}${followUpNote ? ` (${followUpNote})` : ""}`,
            createdAt: new Date().toISOString(),
        });
    }

    await saveCRMData(data, userId);
    return target;
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string, userId?: string): Promise<boolean> {
    const data = await getCRMData(userId);
    const prevLen = data.leads.length;
    data.leads = data.leads.filter((l) => l.id !== id);
    if (data.leads.length !== prevLen) {
        await saveCRMData(data, userId);
        return true;
    }
    return false;
}

/**
 * Batch delete leads
 */
export async function deleteLeads(ids: string[], userId?: string): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData(userId);
    const prevLen = data.leads.length;
    data.leads = data.leads.filter((l) => !idSet.has(l.id));
    const deletedCount = prevLen - data.leads.length;
    if (deletedCount > 0) {
        await saveCRMData(data, userId);
    }
    return deletedCount;
}

/**
 * Batch update stage
 */
export async function batchUpdateStage(ids: string[], stage: LeadStage, userId?: string): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData(userId);
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const lead of data.leads) {
        if (idSet.has(lead.id)) {
            const oldStage = lead.stage;
            lead.stage = stage;
            lead.updatedAt = now;
            if (!lead.activities) lead.activities = [];
            lead.activities.unshift({
                id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: "stage_change",
                content: `Batch moved from ${oldStage} to ${stage}`,
                createdAt: now,
            });
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        await saveCRMData(data, userId);
    }
    return updatedCount;
}

/**
 * Batch update priority
 */
export async function batchUpdatePriority(ids: string[], priority: LeadPriority, userId?: string): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData(userId);
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const lead of data.leads) {
        if (idSet.has(lead.id)) {
            lead.priority = priority;
            lead.updatedAt = now;
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        await saveCRMData(data, userId);
    }
    return updatedCount;
}

/**
 * Mark a lead as contacted and timestamp it
 */
export async function markLeadContacted(id: string, note?: string, userId?: string): Promise<void> {
    try {
        const data = await getCRMData(userId);
        const target = data.leads.find((l) => l.id === id);
        if (target) {
            const now = new Date().toISOString();
            target.lastContactedAt = now;
            target.updatedAt = now;
            if (target.stage === "NEW") {
                target.stage = "CONTACTED";
            }
            if (!target.activities) target.activities = [];
            target.activities.unshift({
                id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type: "message",
                content: note || "WhatsApp bulk message delivered",
                createdAt: now,
            });
            await saveCRMData(data, userId);
        }
    } catch (e) {
        logger.error("CRM", `Failed to mark lead ${id} as contacted`, e);
    }
}

/**
 * Sync Contacts directly from a connected WhatsApp session into CRM
 */
export async function syncContactsFromWhatsApp(sessionId: string, userId?: string): Promise<WhatsAppSyncResult> {
    const dbSession = await prisma.session.findFirst({
        where: { OR: [{ id: sessionId }, { sessionId }] },
        select: { id: true, sessionId: true, userId: true }
    });

    if (!dbSession) {
        throw new Error("WhatsApp session not found");
    }

    const targetUserId = userId || dbSession.userId;
    const userKey = targetUserId ? normalizeKey(targetUserId) : undefined;

    const contacts = await prisma.contact.findMany({
        where: { sessionId: dbSession.id },
        select: { jid: true, name: true, notify: true, remoteJidAlt: true }
    });

    const data = await getCRMData(targetUserId);
    const existingPhones = new Set(data.leads.map((l) => l.formattedPhone));
    const newLeads: Lead[] = [];
    let skippedDuplicates = 0;

    for (const c of contacts) {
        // Skip group JIDs or status broadcasts
        if (!c.jid || c.jid.endsWith("@g.us") || c.jid.includes("status@broadcast")) continue;

        const phoneDigits = c.jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (!phoneDigits || phoneDigits.length < 7) continue;

        if (existingPhones.has(phoneDigits)) {
            skippedDuplicates++;
            continue;
        }

        const name = c.name || c.notify || `WhatsApp Contact ${phoneDigits.slice(-4)}`;
        const now = new Date().toISOString();

        const lead: Lead = {
            id: `lead_wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: userKey,
            name,
            phone: phoneDigits,
            formattedPhone: phoneDigits,
            whatsappJid: `${phoneDigits}@s.whatsapp.net`,
            category: "WhatsApp Inbound",
            stage: "NEW",
            priority: "WARM",
            tags: ["whatsapp-sync", dbSession.sessionId],
            source: "WhatsApp Sync",
            createdAt: now,
            updatedAt: now,
            activities: [
                {
                    id: `act_${Date.now()}_init`,
                    type: "note",
                    content: `Imported from WhatsApp session: ${dbSession.sessionId}`,
                    createdAt: now,
                }
            ]
        };

        newLeads.push(lead);
        existingPhones.add(phoneDigits);
    }

    if (newLeads.length > 0) {
        data.leads.unshift(...newLeads);
        await saveCRMData(data, targetUserId);
    }

    return {
        totalContacts: contacts.length,
        imported: newLeads.length,
        skippedDuplicates,
        leads: newLeads,
    };
}