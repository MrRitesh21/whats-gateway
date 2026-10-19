import fs from "node:fs/promises";
import path from "node:path";
import type { FormsStoreData, LeadForm, FormSubmission } from "./types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const FORMS_FILE = path.join(DATA_DIR, "lead-forms.json");

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

let inMemoryCache: FormsStoreData | null = null;
let lastReadTime = 0;
const CACHE_TTL = 30000; // 30s cache for lightning fast public form rendering without DB roundtrips

export async function getFormsData(): Promise<FormsStoreData> {
    const now = Date.now();
    if (inMemoryCache && now - lastReadTime < CACHE_TTL) {
        return inMemoryCache;
    }

    try {
        // 1. Try reading from PostgreSQL SystemConfig (persistent across redeploys)
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: "default" },
            select: { crmData: true },
        }).catch(() => null);

        if (cfg?.crmData && typeof cfg.crmData === "object") {
            const crmObj = cfg.crmData as any;
            if (crmObj.leadForms && Array.isArray(crmObj.leadForms.forms)) {
                inMemoryCache = {
                    forms: crmObj.leadForms.forms,
                    submissions: Array.isArray(crmObj.leadForms.submissions) ? crmObj.leadForms.submissions : [],
                };
                lastReadTime = now;
                return inMemoryCache;
            }
        }

        // 2. Fallback to local file
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(FORMS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        inMemoryCache = {
            forms: Array.isArray(parsed.forms) ? parsed.forms : DEFAULT_FORMS_DATA.forms,
            submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
        };
        lastReadTime = now;
        return inMemoryCache;
    } catch {
        inMemoryCache = JSON.parse(JSON.stringify(DEFAULT_FORMS_DATA));
        lastReadTime = now;
        saveFormsData(DEFAULT_FORMS_DATA).catch((e) => {
            logger.error("Forms", "Failed to initialize forms storage", e);
        });
        return inMemoryCache!;
    }
}

export async function saveFormsData(data: FormsStoreData): Promise<void> {
    inMemoryCache = data;
    lastReadTime = Date.now();

    // 1. Persist to PostgreSQL SystemConfig under crmData.leadForms
    try {
        const cfg = await prisma.systemConfig.findUnique({
            where: { id: "default" },
            select: { crmData: true },
        }).catch(() => null);

        const currentCrm = (cfg?.crmData && typeof cfg.crmData === "object") ? (cfg.crmData as any) : {};
        currentCrm.leadForms = {
            forms: data.forms,
            submissions: data.submissions.slice(0, 1000), // Keep latest 1000 for storage limits
        };

        await prisma.systemConfig.upsert({
            where: { id: "default" },
            update: { crmData: currentCrm },
            create: { id: "default", crmData: currentCrm },
        });
    } catch (err) {
        logger.error("Forms", "Failed to persist forms data to PostgreSQL", err);
    }

    // 2. Mirror to local file
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const tempFile = `${FORMS_FILE}.tmp.${Date.now()}`;
        await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
        await fs.rename(tempFile, FORMS_FILE);
    } catch {
        // Non-fatal disk error
    }
}

export async function getFormById(id: string): Promise<LeadForm | null> {
    const data = await getFormsData();
    return data.forms.find((f) => f.id === id) || null;
}

export async function saveForm(form: LeadForm): Promise<LeadForm> {
    const data = await getFormsData();
    const idx = data.forms.findIndex((f) => f.id === form.id);
    if (idx >= 0) {
        data.forms[idx] = {
            ...form,
            updatedAt: new Date().toISOString(),
        };
    } else {
        data.forms.unshift({
            ...form,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    await saveFormsData(data);
    return form;
}

export async function deleteForm(id: string): Promise<boolean> {
    const data = await getFormsData();
    const initialLen = data.forms.length;
    data.forms = data.forms.filter((f) => f.id !== id);
    if (data.forms.length !== initialLen) {
        await saveFormsData(data);
        return true;
    }
    return false;
}

export async function incrementFormViews(id: string): Promise<void> {
    const data = await getFormsData();
    const form = data.forms.find((f) => f.id === id);
    if (form) {
        form.viewsCount = (form.viewsCount || 0) + 1;
        await saveFormsData(data);
    }
}

export async function recordSubmission(submission: FormSubmission): Promise<void> {
    const data = await getFormsData();
    data.submissions.unshift(submission);
    const form = data.forms.find((f) => f.id === submission.formId);
    if (form) {
        form.submissionsCount = (form.submissionsCount || 0) + 1;
        if (submission.aiOutreachStatus === "SENT") {
            form.outreachSentCount = (form.outreachSentCount || 0) + 1;
        }
    }
    await saveFormsData(data);
}
