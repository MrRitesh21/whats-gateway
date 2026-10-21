import assert from "node:assert/strict";
import { isFormSubmissionDismissed, removeLeadsAndTrackDismissals } from "../src/lib/crm/form-deletion";
import type { CRMStoreData, Lead } from "../src/lib/crm/types";

const lead: Lead = {
  id: "lead-form-1",
  userId: "owner-1",
  name: "Form lead",
  phone: "9876543210",
  formattedPhone: "919876543210",
  whatsappJid: "919876543210@s.whatsapp.net",
  category: "Website Inbound",
  stage: "NEW",
  tags: ["lead-form"],
  activities: [{ id: "act_form_submission-1", type: "note", content: "Form submitted", createdAt: "2026-01-01T00:00:00.000Z" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const store: CRMStoreData = { leads: [lead], dismissedLeadIds: [], dismissedFormSubmissionIds: [] };
const { data: afterDelete, deletedCount } = removeLeadsAndTrackDismissals(store, [lead.id]);
assert.equal(deletedCount, 1);
assert.deepEqual(afterDelete.leads, []);
assert.deepEqual(afterDelete.dismissedLeadIds, [lead.id]);
assert.deepEqual(afterDelete.dismissedFormSubmissionIds, ["submission-1"]);
assert.equal(isFormSubmissionDismissed(afterDelete, { id: "submission-1", leadId: lead.id }), true);
assert.equal(isFormSubmissionDismissed(afterDelete, { id: "new-submission", leadId: "new-lead-id" }), false);
console.log("CRM lead delete regression checks passed");
