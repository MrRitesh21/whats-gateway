import { normalizePhoneNumber } from "@/lib/crm/csv-parser";
import { getCRMData, saveLead } from "@/lib/crm/storage";
import type { Lead, LeadStage } from "@/lib/crm/types";
import { getFormsData } from "@/lib/forms/storage";
import { logger } from "@/lib/logger";
import { isFormSubmissionDismissed } from "./form-deletion";

// Historical repair is an idempotent migration, not work to repeat on every
// search/pagination request. Form submissions now persist their leads inline.
const reconciledOwners = new Set<string>();
const reconciliationInFlight = new Map<string, Promise<number>>();

/**
 * Repair historical form submissions that were logged but missed by CRM writes.
 * Idempotency is provided by the per-submission activity ID and lead phone match.
 */
export async function reconcileFormSubmissionsToCRM(userId: string): Promise<number> {
    if (reconciledOwners.has(userId)) return 0;
    const existing = reconciliationInFlight.get(userId);
    if (existing) return existing;
    const work = reconcileFormSubmissionsToCRMOnce(userId);
    reconciliationInFlight.set(userId, work);
    try {
        const repaired = await work;
        reconciledOwners.add(userId);
        return repaired;
    } finally {
        reconciliationInFlight.delete(userId);
    }
}

async function reconcileFormSubmissionsToCRMOnce(userId: string): Promise<number> {
    const [formsData, crmData] = await Promise.all([getFormsData(userId), getCRMData(userId)]);
    let repaired = 0;
    for (const submission of formsData.submissions) {
        if (submission.userId && submission.userId !== userId) continue;
        if (isFormSubmissionDismissed(crmData, submission)) continue;
        const form = formsData.forms.find((item) => item.id === submission.formId);
        const rawPhone = submission.phone || submission.data?.phone || submission.data?.whatsapp || submission.data?.mobile || "";
        const { formatted, isValid } = normalizePhoneNumber(rawPhone, "IN");
        if (!isValid || !formatted) continue;
        const current = crmData.leads.find((lead) => lead.id === submission.leadId)
            || crmData.leads.find((lead) => lead.formattedPhone === formatted);
        const details = Object.entries(submission.data || {})
            .filter(([key, value]) => !["name", "fullName", "phone", "whatsapp", "mobile"].includes(key) && value?.trim())
            .map(([key, value]) => `${form?.fields.find((field) => field.id === key)?.label || key}: ${value.trim()}`);
        const activityId = `act_form_${submission.id}`;
        const activity = {
            id: activityId,
            type: "note" as const,
            content: `Submitted lead form "${form?.title || submission.formId}". Details: ${details.join(", ") || "None"}`,
            createdAt: submission.createdAt,
            author: "Form Engine",
        };
        if (current) {
            if (current.activities?.some((item) => item.id === activityId)) continue;
            current.activities = [activity, ...(current.activities || [])];
            current.source ||= `Form: ${form?.title || submission.formId}`;
            current.notes ||= details.length ? `Form Submission Details:\n${details.join("\n")}` : undefined;
            current.updatedAt = new Date().toISOString();
            await saveLead(current, userId);
        } else {
            const lead: Lead = {
                id: submission.leadId || `lead_${formatted}_${submission.id}`,
                userId,
                name: submission.name || submission.data?.name || submission.data?.fullName || "Website Inbound Lead",
                phone: String(rawPhone),
                formattedPhone: formatted,
                whatsappJid: `${formatted}@s.whatsapp.net`,
                category: form?.leadCategory || "Website Inbound",
                stage: (form?.leadStage as LeadStage) || "NEW",
                priority: "WARM",
                source: `Form: ${form?.title || submission.formId}`,
                tags: Array.from(new Set([...(form?.leadTags || []), "lead-form", submission.formId])),
                notes: details.length ? `Form Submission Details:\n${details.join("\n")}` : undefined,
                activities: [activity],
                createdAt: submission.createdAt,
                updatedAt: submission.createdAt,
            };
            await saveLead(lead, userId);
        }
        repaired += 1;
    }
    if (repaired) logger.info("Forms", `Reconciled ${repaired} historical form submission(s) into CRM for tenant ${userId}`);
    return repaired;
}
