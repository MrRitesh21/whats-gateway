import fs from "node:fs/promises";
import path from "node:path";
import type { FormsStoreData, LeadForm, FormSubmission } from "./types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_FORMS_FILE = path.join(DATA_DIR, "lead-forms.json");

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
    return key === "default" ? DEFAULT_FORMS_FILE : path.join(DATA_DIR, `lead-forms-${key}.json`);
}

function getRecordId(userId?: string): string {
    // Forms and CRM must never write the same JSON blob; separate rows avoid
    // PostgreSQL read/modify/write races that used to lose leads or submissions.
    return `forms_${normalizeKey(userId)}`;
}

function getLegacyRecordId(userId?: string): string {
    const key = normalizeKey(userId);
    return key === "default" ? "default" : `user_${key}`;
}

const DEFAULT_SAMPLE_FORM: LeadForm = {
    id: "contact-us",
    title: "Contact & Demo Request",
    description: "Fill out this quick form and our AI assistant will reach out to you on WhatsApp instantly!",
    fields: [
        {
            id: "name",
            label: "Full Name",
            type: "text",
            placeholder: "e.g. John Doe",
            required: true,
        },
        {
            id: "phone",
            label: "WhatsApp Number",
            type: "tel",
            placeholder: "e.g. +91 9935370814",
            required: true,
            helpText: "Include country code for instant WhatsApp greeting",
        },
        {
            id: "email",
            label: "Email Address",
            type: "email",
            placeholder: "john@example.com",
            required: false,
        },
        {
            id: "service",
            label: "Service / Interest",
            type: "select",
            required: true,
            options: ["WhatsApp API Gateway", "AI Chatbot & Automation", "Bulk Messaging", "Custom Software / Web Development", "Other"],
            defaultValue: "WhatsApp API Gateway",
        },
        {
            id: "message",
            label: "Requirements / Project Notes",
            type: "textarea",
            placeholder: "Tell us briefly about what you are looking for...",
            required: false,
        },
    ],
    submitButtonText: "Submit & Connect on WhatsApp",
    successMessage: "Thank you! Your inquiry has been received. Check your WhatsApp for an instant message from us!",
    sessionId: "",
    leadStage: "NEW",
    leadCategory: "Website Inbound",
    leadTags: ["website", "lead-form"],
    enableAiOutreach: true,
    outreachMode: "ai_personalized",
    aiPrompt: "Greet the lead warmly by name. Mention their interest in their chosen service. Explain that we can set up their WhatsApp automation or schedule a 10-minute live demo. Keep it friendly, professional, and invite them to reply.",
    templateMessage: "Hello {{name}}! 👋 Thank you for reaching out to us regarding {{service}}. We received your inquiry and our team is ready to assist you. How can we help you today?",
    theme: "emerald",
    brandColor: "#10B981",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    borderRadius: 12,
    viewsCount: 0,
    submissionsCount: 0,
    outreachSentCount: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const DEFAULT_FORMS_DATA: FormsStoreData = {
    forms: [DEFAULT_SAMPLE_FORM],
    submissions: [],
};

interface CacheEntry {
    data: FormsStoreData;
    lastReadTime: number;
}
const inMemoryCaches = new Map<string, CacheEntry>();
const CACHE_TTL = 30000;

export async function getFormsData(userId?: string): Promise<FormsStoreData> {
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
        // 1. Try reading from PostgreSQL SystemConfig (persistent across redeploys)
        let cfg = await prisma.systemConfig.findUnique({
            where: { id: recordId },
            select: { crmData: true },
        }).catch(() => null);
        // Read existing submissions from the legacy shared tenant row once;
        // writes below persist only to this dedicated forms row.
        if (!Array.isArray((cfg?.crmData as any)?.leadForms?.forms)) {
            cfg = await prisma.systemConfig.findUnique({
                where: { id: getLegacyRecordId(userId) },
                select: { crmData: true },
            }).catch(() => null);
        }

        if (cfg?.crmData && typeof cfg.crmData === "object") {
            const crmObj = cfg.crmData as any;
            if (crmObj.leadForms && Array.isArray(crmObj.leadForms.forms)) {
                const forms: LeadForm[] = key === "default"
                    ? crmObj.leadForms.forms
                    : crmObj.leadForms.forms.map((f: LeadForm) => ({ ...f, userId: f.userId || userKey }));
                const submissions: FormSubmission[] = Array.isArray(crmObj.leadForms.submissions)
                    ? (key === "default" ? crmObj.leadForms.submissions : crmObj.leadForms.submissions.map((s: FormSubmission) => ({ ...s, userId: s.userId || userKey })))
                    : [];

                const data: FormsStoreData = { forms, submissions };
                inMemoryCaches.set(key, { data, lastReadTime: now });
                return data;
            }
        }

        // 2. Fallback to local file
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(configFile, "utf-8");
        const parsed = JSON.parse(raw);
        const forms: LeadForm[] = Array.isArray(parsed.forms)
            ? (key === "default" ? parsed.forms : parsed.forms.map((f: LeadForm) => ({ ...f, userId: f.userId || userKey })))
            : (key === "default" ? DEFAULT_FORMS_DATA.forms : []);
        const submissions: FormSubmission[] = Array.isArray(parsed.submissions)
            ? (key === "default" ? parsed.submissions : parsed.submissions.map((s: FormSubmission) => ({ ...s, userId: s.userId || userKey })))
            : [];

        const data: FormsStoreData = { forms, submissions };
        inMemoryCaches.set(key, { data, lastReadTime: now });
        return data;
    } catch {
        // Superadmin initial migration from default if needed
        if (key !== "default" && userKey === "cmvdpdy2j00011t8kodp9jhy8") {
            try {
                const defaultData = await getFormsData("default");
                if (defaultData.forms.length > 0) {
                    const migrated: FormsStoreData = {
                        forms: defaultData.forms.map((f) => ({ ...f, userId: userKey })),
                        submissions: defaultData.submissions.map((s) => ({ ...s, userId: userKey })),
                    };
                    inMemoryCaches.set(key, { data: migrated, lastReadTime: now });
                    saveFormsData(migrated, userId).catch(() => {});
                    return migrated;
                }
            } catch {}
        }

        // For all other users/tenants: Clean isolated slate
        const fresh: FormsStoreData = {
            forms: key === "default" ? DEFAULT_FORMS_DATA.forms : [],
            submissions: [],
        };
        inMemoryCaches.set(key, { data: fresh, lastReadTime: now });

        if (key === "default") {
            saveFormsData(DEFAULT_FORMS_DATA, "default").catch((e) => {
                logger.error("Forms", "Failed to initialize forms storage", e);
            });
        }
        return fresh;
    }
}

export async function saveFormsData(data: FormsStoreData, userId?: string): Promise<void> {
    const key = getCacheKey(userId);
    const recordId = getRecordId(userId);
    const configFile = getConfigFile(userId);

    inMemoryCaches.set(key, { data, lastReadTime: Date.now() });

    // 1. Persist to PostgreSQL SystemConfig under crmData.leadForms
    try {
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: recordId },
            select: { crmData: true },
        }).catch(() => null);

        const currentCrm = (cfg?.crmData && typeof cfg.crmData === "object") ? (cfg.crmData as any) : {};
        currentCrm.leadForms = {
            forms: data.forms,
            submissions: data.submissions.slice(0, 1000), // Keep latest 1000 for storage limits
        };

        await prisma.systemConfig.upsert({
            where: { id: recordId },
            update: { crmData: currentCrm },
            create: { id: recordId, crmData: currentCrm },
        });
    } catch (err) {
        logger.error("Forms", `Failed to persist forms data for ${key} to PostgreSQL`, err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${configFile}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tempFile, configFile);
    } catch {
        // Non-fatal disk error
    }
}

export async function getFormById(id: string, userId?: string): Promise<LeadForm | null> {
    if (userId) {
        const data = await getFormsData(userId);
        const found = data.forms.find((f) => f.id === id);
        if (found) return found;
    }

    // Public form URLs have no authenticated tenant context. Resolve against
    // durable storage and prefer the uniquely owned tenant form over the
    // legacy shared/default form (for example, the old "contact-us" ID).
    try {
        const configs = await prisma.systemConfig.findMany({
            select: { id: true, crmData: true },
        });
        const owned = new Map<string, LeadForm>();
        let defaultForm: LeadForm | null = null;

        for (const row of configs) {
            const crm = row.crmData as any;
            const forms = crm?.leadForms?.forms;
            if (!Array.isArray(forms)) continue;
            const form = forms.find((item: LeadForm) => item.id === id);
            if (!form) continue;

            const inferredOwner = row.id.startsWith("forms_user_")
                ? row.id.slice("forms_user_".length)
                : row.id.startsWith("user_")
                    ? row.id.slice("user_".length)
                    : undefined;
            const owner = form.userId || inferredOwner;
            if (owner && owner !== "default") {
                owned.set(owner, { ...form, userId: owner });
            } else {
                defaultForm ||= { ...form, userId: undefined };
            }
        }

        // Never pick an arbitrary tenant if a legacy ID is ambiguous.
        if (owned.size === 1) return owned.values().next().value || null;
        if (owned.size > 1) return null;
        if (defaultForm) return defaultForm;
    } catch (error) {
        logger.error("Forms", `Failed to resolve public form ${id} from durable storage`, error);
    }

    // DB unavailable: deterministic cache fallback, owned partitions before default.
    const entries = [...inMemoryCaches.entries()].sort(([a], [b]) => {
        if (a === "default") return 1;
        if (b === "default") return -1;
        return a.localeCompare(b);
    });
    const cachedMatches = entries
        .map(([key, entry]) => ({ key, form: entry.data.forms.find((item) => item.id === id) }))
        .filter((entry): entry is { key: string; form: LeadForm } => Boolean(entry.form));
    const cachedOwners = cachedMatches.filter(({ key }) => key !== "default");
    if (cachedOwners.length === 1) return cachedOwners[0].form;
    if (cachedOwners.length > 1) return null;
    return cachedMatches.find(({ key }) => key === "default")?.form || null;
}

export async function saveForm(form: LeadForm, userId?: string): Promise<LeadForm> {
    const targetUserId = userId || form.userId;
    if (targetUserId) {
        form.userId = normalizeKey(targetUserId);
    }
    const data = await getFormsData(targetUserId);
    const idx = data.forms.findIndex((f) => f.id === form.id);
    if (idx >= 0) {
        data.forms[idx] = {
            ...form,
            userId: form.userId || data.forms[idx].userId || (targetUserId ? normalizeKey(targetUserId) : undefined),
            updatedAt: new Date().toISOString(),
        };
    } else {
        data.forms.unshift({
            ...form,
            userId: form.userId || (targetUserId ? normalizeKey(targetUserId) : undefined),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    await saveFormsData(data, targetUserId);
    return form;
}

export async function deleteForm(id: string, userId?: string): Promise<boolean> {
    const target = await getFormById(id, userId);
    const targetUserId = userId || target?.userId;
    const data = await getFormsData(targetUserId);
    const initialLen = data.forms.length;
    data.forms = data.forms.filter((f) => f.id !== id);
    if (data.forms.length !== initialLen) {
        await saveFormsData(data, targetUserId);
        return true;
    }
    return false;
}

export async function incrementFormViews(id: string, userId?: string): Promise<void> {
    const target = await getFormById(id, userId);
    const targetUserId = userId || target?.userId;
    const data = await getFormsData(targetUserId);
    const form = data.forms.find((f) => f.id === id);
    if (form) {
        form.viewsCount = (form.viewsCount || 0) + 1;
        await saveFormsData(data, targetUserId);
    }
}

export async function recordSubmission(submission: FormSubmission, userId?: string): Promise<void> {
    const target = await getFormById(submission.formId, userId);
    const targetUserId = userId || submission.userId || target?.userId;
    if (targetUserId) {
        submission.userId = normalizeKey(targetUserId);
    }
    const data = await getFormsData(targetUserId);
    const existingIndex = data.submissions.findIndex((item) => item.id === submission.id);
    const existing = existingIndex >= 0 ? data.submissions[existingIndex] : undefined;
    if (existingIndex >= 0) {
        data.submissions[existingIndex] = { ...existing, ...submission };
    } else {
        data.submissions.unshift(submission);
    }
    const form = data.forms.find((f) => f.id === submission.formId);
    if (form) {
        if (!existing) form.submissionsCount = (form.submissionsCount || 0) + 1;
        if (submission.aiOutreachStatus === "SENT" && existing?.aiOutreachStatus !== "SENT") {
            form.outreachSentCount = (form.outreachSentCount || 0) + 1;
        }
    }
    await saveFormsData(data, targetUserId);
}