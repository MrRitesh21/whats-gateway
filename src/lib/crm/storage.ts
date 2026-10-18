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
const CRM_FILE = path.join(DATA_DIR, "crm-leads.json");

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

let inMemoryCache: CRMStoreData | null = null;
let lastReadTime = 0;
const CACHE_TTL = 3000;

export async function getCRMData(): Promise<CRMStoreData> {
    const now = Date.now();
    if (inMemoryCache && now - lastReadTime < CACHE_TTL) {
        return inMemoryCache;
    }

    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(CRM_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        inMemoryCache = {
            leads: Array.isArray(parsed.leads) ? parsed.leads : DEFAULT_CRM_DATA.leads,
            customStages: Array.isArray(parsed.customStages) ? parsed.customStages : DEFAULT_CRM_DATA.customStages,
        };
        lastReadTime = now;
        return inMemoryCache;
    } catch {
        try {
            await saveCRMData(DEFAULT_CRM_DATA);
        } catch (e) {
            logger.error("CRM", "Failed to create default CRM storage file", e);
        }
        inMemoryCache = JSON.parse(JSON.stringify(DEFAULT_CRM_DATA));
        lastReadTime = now;
        return inMemoryCache!;
    }
}

export async function saveCRMData(data: CRMStoreData): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${CRM_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempFile, CRM_FILE);
    inMemoryCache = data;
    lastReadTime = Date.now();
}

/**
 * Import leads from a CSV string into the CRM store
 */
export async function importLeads(csvText: string): Promise<CSVImportResult> {
    const data = await getCRMData();
    const existingPhoneSet = new Set(data.leads.map((l) => l.formattedPhone));

    const result = parseLeadsFromCSV(csvText, existingPhoneSet);
    if (result.leads.length > 0) {
        data.leads.unshift(...result.leads);
        await saveCRMData(data);
    }

    return result;
}

/**
 * Save or update a single lead
 */
export async function saveLead(lead: Lead): Promise<Lead> {
    const data = await getCRMData();
    const idx = data.leads.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
        const existing = data.leads[idx];
        data.leads[idx] = {
            ...existing,
            ...lead,
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
    await saveCRMData(data);
    return lead;
}

/**
 * Update lead stage with optional activity note
 */
export async function updateLeadStage(id: string, stage: LeadStage, note?: string): Promise<Lead | null> {
    const data = await getCRMData();
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

    await saveCRMData(data);
    return target;
}

/**
 * Update lead priority (HOT, WARM, COLD)
 */
export async function updateLeadPriority(id: string, priority: LeadPriority): Promise<Lead | null> {
    const data = await getCRMData();
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

    await saveCRMData(data);
    return target;
}

/**
 * Add an activity / note to lead timeline
 */
export async function addLeadActivity(
    leadId: string,
    activity: Omit<LeadActivity, "id" | "createdAt">
): Promise<Lead | null> {
    const data = await getCRMData();
    const target = data.leads.find((l) => l.id === leadId);
    if (!target) return null;

    if (!target.activities) target.activities = [];
    target.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...activity,
        createdAt: new Date().toISOString(),
    });
    target.updatedAt = new Date().toISOString();

    await saveCRMData(data);
    return target;
}

/**
 * Update follow-up reminder date and note
 */
export async function updateLeadFollowUp(
    id: string,
    followUpDate?: string,
    followUpNote?: string
): Promise<Lead | null> {
    const data = await getCRMData();
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

    await saveCRMData(data);
    return target;
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string): Promise<boolean> {
    const data = await getCRMData();
    const prevLen = data.leads.length;
    data.leads = data.leads.filter((l) => l.id !== id);
    if (data.leads.length !== prevLen) {
        await saveCRMData(data);
        return true;
    }
    return false;
}

/**
 * Batch delete leads
 */
export async function deleteLeads(ids: string[]): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData();
    const prevLen = data.leads.length;
    data.leads = data.leads.filter((l) => !idSet.has(l.id));
    const deletedCount = prevLen - data.leads.length;
    if (deletedCount > 0) {
        await saveCRMData(data);
    }
    return deletedCount;
}

/**
 * Batch update stage
 */
export async function batchUpdateStage(ids: string[], stage: LeadStage): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData();
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
        await saveCRMData(data);
    }
    return updatedCount;
}

/**
 * Batch update priority
 */
export async function batchUpdatePriority(ids: string[], priority: LeadPriority): Promise<number> {
    const idSet = new Set(ids);
    const data = await getCRMData();
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
        await saveCRMData(data);
    }
    return updatedCount;
}

/**
 * Mark a lead as contacted and timestamp it
 */
export async function markLeadContacted(id: string, note?: string): Promise<void> {
    try {
        const data = await getCRMData();
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
            await saveCRMData(data);
        }
    } catch (e) {
        logger.error("CRM", `Failed to mark lead ${id} as contacted`, e);
    }
}

/**
 * Sync Contacts directly from a connected WhatsApp session into CRM
 */
export async function syncContactsFromWhatsApp(sessionId: string): Promise<WhatsAppSyncResult> {
    const dbSession = await prisma.session.findFirst({
        where: { OR: [{ id: sessionId }, { sessionId }] },
        select: { id: true, sessionId: true }
    });

    if (!dbSession) {
        throw new Error("WhatsApp session not found");
    }

    const contacts = await prisma.contact.findMany({
        where: { sessionId: dbSession.id },
        select: { jid: true, name: true, notify: true, remoteJidAlt: true }
    });

    const data = await getCRMData();
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
        await saveCRMData(data);
    }

    return {
        totalContacts: contacts.length,
        imported: newLeads.length,
        skippedDuplicates,
        leads: newLeads,
    };
}
