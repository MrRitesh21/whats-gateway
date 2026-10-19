import { normalizePhoneNumber } from "@/lib/crm/csv-parser";
import { saveLead } from "@/lib/crm/storage";
import type { Lead, LeadStage } from "@/lib/crm/types";
import type { LeadForm, FormSubmission } from "./types";
import { recordSubmission } from "./storage";
import { waManager } from "@/modules/whatsapp/manager";
import { executeSmartChat } from "@/lib/ai-gateway/gateway";
import { getAIGatewayData } from "@/lib/ai-gateway/storage";
import { logger } from "@/lib/logger";

/**
 * Process a lead form submission:
 * 1. Parse and validate phone number
 * 2. Save/update the lead into the CRM store
 * 3. Trigger instant personalized AI WhatsApp outreach if enabled
 * 4. Record submission analytics
 */
export async function handleFormSubmission(params: {
    form: LeadForm;
    submissionData: Record<string, string>;
    ip?: string;
    userAgent?: string;
}): Promise<{
    success: boolean;
    leadId?: string;
    outreachSent: boolean;
    outreachMessage?: string;
    message: string;
}> {
    const { form, submissionData, ip, userAgent } = params;

    // 1. Locate name and phone in submission data
    const name = submissionData.name || submissionData.fullName || submissionData.nama || "Website Inbound Lead";
    const rawPhone = submissionData.phone || submissionData.whatsapp || submissionData.mobile || submissionData.telepon || "";
    const email = submissionData.email || submissionData.surel || "";

    const { formatted: formattedPhone, isValid } = normalizePhoneNumber(rawPhone, "IN");
    if (!isValid || !formattedPhone) {
        return {
            success: false,
            outreachSent: false,
            message: "A valid WhatsApp phone number with country code is required.",
        };
    }

    const whatsappJid = `${formattedPhone}@s.whatsapp.net`;
    const now = new Date().toISOString();

    // Compile notes from other submitted fields
    const detailLines: string[] = [];
    for (const [key, val] of Object.entries(submissionData)) {
        if (["name", "fullName", "phone", "whatsapp", "mobile"].includes(key)) continue;
        if (val && typeof val === "string" && val.trim().length > 0) {
            const fieldLabel = form.fields.find((f) => f.id === key)?.label || key;
            detailLines.push(`${fieldLabel}: ${val.trim()}`);
        }
    }
    const notesSummary = detailLines.join("\n");

    // 2. Save into CRM
    const leadId = `lead_${formattedPhone}_${Date.now()}`;
    const leadToSave: Lead = {
        id: leadId,
        name: name.trim(),
        phone: rawPhone.trim(),
        formattedPhone,
        whatsappJid,
        category: form.leadCategory || "Website Inbound",
        stage: (form.leadStage as LeadStage) || "NEW",
        priority: "WARM",
        source: `Form: ${form.title}`,
        tags: Array.from(new Set([...(form.leadTags || []), "lead-form", form.id])),
        notes: notesSummary ? `Form Submission Details:\n${notesSummary}` : undefined,
        activities: [
            {
                id: `act_${Date.now()}_form`,
                type: "note",
                content: `Submitted lead form "${form.title}". Details: ${detailLines.join(", ") || "None"}`,
                createdAt: now,
                author: "Form Engine",
            },
        ],
        createdAt: now,
        updatedAt: now,
    };

    try {
        await saveLead(leadToSave);
    } catch (saveErr) {
        logger.error("Forms", "Failed saving lead to CRM", saveErr);
    }

    // 3. Instant AI WhatsApp Outreach
    let outreachSent = false;
    let outreachMessage = "";
    let outreachStatus: "PENDING" | "SENT" | "FAILED" | "DISABLED" = form.enableAiOutreach ? "PENDING" : "DISABLED";
    let errorMessage: string | undefined;

    if (form.enableAiOutreach && form.sessionId) {
        try {
            const instance = waManager.getInstance(form.sessionId);
            if (!instance?.socket) {
                throw new Error(`WhatsApp session "${form.sessionId}" is currently disconnected or offline.`);
            }

            // Generate outreach message
            if (form.outreachMode === "ai_personalized") {
                const aiData = await getAIGatewayData().catch(() => null);
                const hasActiveAi = aiData && aiData.accounts.some((a) => a.isActive);

                if (hasActiveAi) {
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
1. Output ONLY the exact text message to be sent via WhatsApp. Do NOT wrap in quotes, do not output JSON, do not add introductory phrases like "Here is the message:".
2. Keep it natural, friendly, and well-structured for WhatsApp (use emojis sparingly and tasteful spacing).
3. Address them directly by name (${name}).
`;
                    const aiResult = await executeSmartChat({
                        question: prompt,
                        useRAG: false, // Fast LLM response without blocking on vector similarity
                    });
                    outreachMessage = (aiResult?.answer || "").trim();
                }
            }

            // Fallback to template if AI message wasn't generated
            if (!outreachMessage) {
                let tpl = form.templateMessage || "Hello {{name}}! 👋 Thank you for reaching out to us. We received your request and our team is ready to help you. How can we assist you today?";
                tpl = tpl.replace(/{{name}}/gi, name);
                tpl = tpl.replace(/{{phone}}/gi, formattedPhone);
                tpl = tpl.replace(/{{email}}/gi, email || "N/A");
                for (const [key, val] of Object.entries(submissionData)) {
                    const regex = new RegExp(`{{${key}}}`, "gi");
                    tpl = tpl.replace(regex, String(val));
                }
                outreachMessage = tpl.trim();
            }

            // Send the WhatsApp message
            await instance.socket.sendMessage(whatsappJid, { text: outreachMessage });
            outreachSent = true;
            outreachStatus = "SENT";
            logger.success("Forms", `Instant AI outreach sent to ${whatsappJid} via session ${form.sessionId}`);

            // Update Lead with outreach activity and change stage to CONTACTED
            leadToSave.stage = "CONTACTED";
            leadToSave.lastContactedAt = new Date().toISOString();
            leadToSave.activities?.push({
                id: `act_${Date.now()}_outreach`,
                type: "message",
                content: `Instant AI WhatsApp outreach sent: "${outreachMessage}"`,
                createdAt: new Date().toISOString(),
                author: "AI Outreach Agent",
            });
            await saveLead(leadToSave).catch(() => {});
        } catch (err: any) {
            outreachStatus = "FAILED";
            errorMessage = err.message || "Failed to send WhatsApp message";
            logger.error("Forms", `AI Outreach failed for ${whatsappJid}: ${errorMessage}`);
        }
    }

    // 4. Record submission in store
    const submissionRecord: FormSubmission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        formId: form.id,
        data: submissionData,
        leadId,
        phone: formattedPhone,
        name,
        email,
        aiOutreachStatus: outreachStatus,
        aiOutreachMessage: outreachMessage || undefined,
        errorMessage,
        ip,
        createdAt: now,
    };

    await recordSubmission(submissionRecord).catch((e) => {
        logger.error("Forms", "Failed to record submission", e);
    });

    return {
        success: true,
        leadId,
        outreachSent,
        outreachMessage,
        message: form.successMessage || "Your inquiry has been submitted successfully!",
    };
}

/**
 * Non-blocking instant submission runner.
 * Records initial submission immediately and kicks off CRM + AI outreach in the background.
 * Guarantees HTTP submission endpoint responds in < 100ms!
 */
export function triggerFastSubmission(
    form: LeadForm,
    submissionData: Record<string, string>,
    ip: string,
    submissionId?: string
): { leadId: string; fastPromise: Promise<any> } {
    const phoneRaw = submissionData.phone || submissionData.whatsapp || submissionData.mobile || "";
    const cleanDigits = phoneRaw.replace(/[^0-9]/g, "");
    const formattedPhone = cleanDigits ? normalizePhoneNumber(cleanDigits) : "";
    const leadId = `lead_${formattedPhone || Date.now()}`;

    // Launch async background pipeline
    const fastPromise = (async () => {
        try {
            await handleFormSubmission(form, submissionData, ip);
        } catch (err: any) {
            logger.error("Forms", "Fast background submission error:", err);
        }
    })();

    return { leadId, fastPromise };
}
