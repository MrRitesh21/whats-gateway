import assert from "node:assert/strict";
import { buildFormLeadAlert } from "../src/lib/forms/lead-alert";

const alert = buildFormLeadAlert({
  userId: "owner-1",
  formTitle: "Website Quote",
  name: "Samira Khan",
});
assert.deepEqual(alert, {
  userId: "owner-1",
  title: "New form lead",
  message: 'Samira Khan submitted "Website Quote". Open Lead Forms to review it.',
  type: "SUCCESS",
  href: "/dashboard/lead-forms",
  read: false,
});
console.log("Form lead alert checks passed");
