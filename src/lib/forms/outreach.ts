import { normalizePhoneNumber } from "@/lib/crm/csv-parser";
import { getCRMData, saveLead } from "@/lib/crm/storage";
import type { Lead, LeadStage } from "@/lib/crm/types";
import type { LeadForm, FormSubmission } from "./types";
import { recordSubmission } from "./storage";
import { waManager } from "@/modules/whatsapp/manager";
import { executeSmartChat } from "@/lib/ai-gateway/gateway";
import { getAIGatewayData } from "@/lib/ai-gateway/storage";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildFormLeadAlert } from "./lead-alert";

export interface CaptureFormSubmissionParams {
    form: LeadForm;
    submissionData: Record<string, string>;
    ip?: string;
    userAgent?: string;
}

export interface CapturedFormSubmission {
    form: LeadForm;
    submissionData: Record<string, string>;
    lead: Lead;
    submission: FormSubmission;
    name: string;
    email: string;
    formattedPhone: string;
    whatsappJid: string;
    notesSummary: string;
}

/**
 * Persist the canonical lead and form submission before acknowledging the
 * public request, so background delivery/restarts cannot lose CRM capture.
 */
export async function captureFormSubmission(params: CaptureFormSubmissionParams): Promise<CapturedFormSubmission> {
    const { form, submissionData, ip } = params;
    const name = (submissionData.name || submissionData.fullName || submissionData.nama || "Website Inbound Lead").trim();
    const rawPhone = submissionData.phone || submissionData.whatsapp || submissionData.mobile || submissionData.telepon || "";
    const email = submissionData.email || submissionData.surel || "";
    const { formatted: formattedPhone, isValid } = normalizePhoneNumber(rawPhone, "IN");
    if (!isValid || !formattedPhone) throw new Error("A valid WhatsApp phone number with country code is required.");

    const detailLines = Object.entries(submissionData)
        .filter(([key, value]) => !["name", "fullName", "phone", "whatsapp", "mobile"].includes(key) && value?.trim())
        .map(([key, value]) => `${form.fields.find((field) => field.id === key)?.label || key}: ${value.trim()}`);
    const notesSummary = detailLines.join("\n");
    const whatsappJid = `${formattedPhone}@s.whatsapp.net`;
    const now = new Date().toISOString();
    const suffix = Math.random().toString(36).slice(2, 8);
    const crmSnapshot = await getCRMData(form.userId);
    const existingLead = crmSnapshot.leads.find((item) => item.formattedPhone === formattedPhone);
    // Stable fallback ID makes simultaneous/retried form posts for one phone an
    // upsert rather than creating duplicate CRM rows.
    const leadId = existingLead?.id || `lead_form_${formattedPhone}`;
    const activity = {
        id: `act_${form.id}_${Date.now()}_${suffix}`,
        type: "note" as const,
        content: `Submitted lead form "${form.title}". Details: ${detailLines.join(", ") || "None"}`,
        createdAt: now,
        author: "Form Engine",
    };
    const lead: Lead = {
        id: leadId,
        userId: form.userId,
        name,
        phone: rawPhone.trim(),
        formattedPhone,
        whatsappJid,
        category: existingLead?.category || form.leadCategory || "Website Inbound",
        stage: existingLead?.stage || (form.leadStage as LeadStage) || "NEW",
        priority: existingLead?.priority || "WARM",
        source: existingLead?.source || `Form: ${form.title}`,
        tags: Array.from(new Set([...(existingLead?.tags || []), ...(form.leadTags || []), "lead-form", form.id])),
        notes: [existingLead?.notes, notesSummary ? `Form Submission Details:\n${notesSummary}` : ""].filter(Boolean).join("\n\n") || undefined,
        activities: [activity, ...(existingLead?.activities || [])],
        createdAt: existingLead?.createdAt || now,
        updatedAt: now,
    };

    // Fail the request if CRM persistence fails; never acknowledge an uncaptured lead.
    await saveLead(lead, form.userId);

    const submission: FormSubmission = {
        id: `sub_${Date.now()}_${suffix}`,
        formId: form.id,
        userId: form.userId,
        data: submissionData,
        leadId,
        phone: formattedPhone,
        name,
        email,
        aiOutreachStatus: form.enableAiOutreach ? "PENDING" : "DISABLED",
        ip,
        createdAt: now,
    };
    await recordSubmission(submission, form.userId);

    return { form, submissionData, lead, submission, name, email, formattedPhone, whatsappJid, notesSummary };
}

/** Persist and emit a realtime in-app alert to the form owner. */
export async function dispatchFormLeadAlert(captured: CapturedFormSubmission): Promise<void> {
    const { form, name } = captured;
    if (form.enableLeadAlerts === false || !form.userId) return;

    try {
        const payload = buildFormLeadAlert({
            userId: form.userId,
            formTitle: form.title,
            name,
        });
        const notification = await prisma.notification.create({ data: payload });
        const io = (globalThis as any).io;
        io?.to(`user:${form.userId}`).emit("notification:new", notification);
    } catch (error) {
        logger.error("Forms", `Failed to create lead alert for form ${form.id}`, error);
    }
}

/** Deliver WhatsApp outreach only after CRM and form records are durable. */
export async function dispatchFormOutreach(captured: CapturedFormSubmission): Promise<void> {
    const { form, submissionData, lead, submission, name, email, formattedPhone, whatsappJid, notesSummary } = captured;
    if (!form.enableAiOutreach) return;

    let status: "SENT" | "FAILED" = "FAILED";
    let outreachMessage = "";
    let errorMessage: string | undefined;

    try {
        if (!form.sessionId) throw new Error("No WhatsApp session is selected for this form.");
        const instance = waManager.getInstance(form.sessionId);
        if (!instance?.socket) throw new Error(`WhatsApp session "${form.sessionId}" is currently disconnected or offline.`);

        if (form.outreachMode === "ai_personalized") {
            const aiData = await getAIGatewayData(form.userId).catch(() => null);
            if (aiData?.accounts.some((account) => account.isActive)) {
                const prompt = `
CRITICAL TASK: Generate an immediate personalized WhatsApp outreach message for a new inbound customer lead.
- Prospect Name: ${name}
- Prospect WhatsApp: +${formattedPhone}
- Inquired Via Form: "${form.title}"
- Inquired Details & Interest:
${notesSummary || "General Inquiry"}

Client Tone & Instructions:
${form.aiPrompt || "Greet them warmly, thank them for submitting the inquiry, acknowledge what they asked for, and politely ask when we can schedule a quick 10-minute demo or consultation call."}

RULES:
1. Output ONLY the exact text message to be sent via WhatsApp. Do NOT wrap in quotes, do not output JSON, do not add introductory phrases.
2. Keep it natural, friendly, and well-structured for WhatsApp.
3. Address them directly by name (${name}).
`;
                const result = await executeSmartChat({ question: prompt, useRAG: false, userId: form.userId });
                outreachMessage = (result?.answer || "").trim();
            }
        }

        if (!outreachMessage) {
            let template = form.templateMessage || "Hello {{name}}! 👋 Thank you for reaching out to us. We received your request and our team is ready to help you. How can we assist you today?";
            template = template.replace(/{{name}}/gi, name).replace(/{{phone}}/gi, formattedPhone).replace(/{{email}}/gi, email || "N/A");
            for (const [key, value] of Object.entries(submissionData)) {
                template = template.replace(new RegExp(`{{${key}}}`, "gi"), String(value));
            }
            outreachMessage = template.trim();
        }

        await instance.socket.sendMessage(whatsappJid, { text: outreachMessage });
        status = "SENT";
        lead.stage = "CONTACTED";
        lead.lastContactedAt = new Date().toISOString();
        lead.activities?.push({
            id: `act_${Date.now()}_outreach`,
            type: "message",
            content: `Instant AI WhatsApp outreach sent: "${outreachMessage}"`,
            createdAt: new Date().toISOString(),
            author: "AI Outreach Agent",
        });
        await saveLead(lead, form.userId);
        logger.success("Forms", `Instant AI outreach sent to ${whatsappJid} via session ${form.sessionId}`);
    } catch (err: any) {
        errorMessage = err?.message || "Failed to send WhatsApp message";
        logger.error("Forms", `AI outreach failed for ${whatsappJid}: ${errorMessage}`);
    }

    await recordSubmission({
        ...submission,
        aiOutreachStatus: status,
        aiOutreachMessage: outreachMessage || undefined,
        errorMessage,
    }, form.userId);
}

/** Backward-compatible synchronous pipeline for internal callers. */
export async function handleFormSubmission(params: CaptureFormSubmissionParams): Promise<{
    success: boolean;
    leadId?: string;
    outreachSent: boolean;
    outreachMessage?: string;
    message: string;
}> {
    const captured = await captureFormSubmission(params);
    if (captured.form.enableAiOutreach) await dispatchFormOutreach(captured);
    return {
        success: true,
        leadId: captured.lead.id,
        outreachSent: false,
        message: captured.form.successMessage || "Your inquiry has been submitted successfully!",
    };
}

/** Legacy non-blocking wrapper. */
export function triggerFastSubmission(params: CaptureFormSubmissionParams): { leadId: string; fastPromise: Promise<any> } {
    const leadId = `lead_${Date.now()}`;
    const fastPromise = handleFormSubmission(params).catch((err) => {
        logger.error("Forms", "Fast background submission error", err);
        throw err;
    });
    return { leadId, fastPromise };
}
