import type { CRMStoreData, Lead } from "./types";

function formSubmissionIds(lead: Lead): string[] {
  return (lead.activities || [])
    .map((activity) => activity.id)
    .filter((id) => id.startsWith("act_form_"))
    .map((id) => id.slice("act_form_".length));
}

export function removeLeadsAndTrackDismissals(data: CRMStoreData, ids: string[]) {
  const idSet = new Set(ids);
  const removed = data.leads.filter((lead) => idSet.has(lead.id));
  const nextData: CRMStoreData = {
    ...data,
    leads: data.leads.filter((lead) => !idSet.has(lead.id)),
    dismissedLeadIds: Array.from(new Set([...(data.dismissedLeadIds || []), ...removed.map((lead) => lead.id)])),
    dismissedFormSubmissionIds: Array.from(new Set([...(data.dismissedFormSubmissionIds || []), ...removed.flatMap(formSubmissionIds)])),
  };
  return { data: nextData, deletedCount: removed.length };
}

export function isFormSubmissionDismissed(
  data: Pick<CRMStoreData, "dismissedLeadIds" | "dismissedFormSubmissionIds">,
  submission: { id: string; leadId?: string | null },
): boolean {
  return !!(
    data.dismissedFormSubmissionIds?.includes(submission.id)
    || (submission.leadId && data.dismissedLeadIds?.includes(submission.leadId))
  );
}
