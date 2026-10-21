import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { findMatchingChannelKeyword, matchesChannelRule, parseWhatsAppCloudMessages, verifyMetaSignature } from "../src/lib/channel-automation";

assert.equal(matchesChannelRule("I need pricing details", { keyword: "pricing", matchType: "CONTAINS" }), true);
assert.equal(matchesChannelRule("PRICE", { keyword: "price", matchType: "EXACT" }), true);
assert.equal(matchesChannelRule("Price please", { keyword: "price", matchType: "STARTS_WITH" }), true);
assert.equal(matchesChannelRule("Order 42", { keyword: "\\d+", matchType: "REGEX" }), true);
assert.equal(matchesChannelRule("anything", { keyword: "[", matchType: "REGEX" }), false);
assert.equal(matchesChannelRule("Tell me the PRIZING please", { keyword: "pricing, prizing", matchType: "CONTAINS" }), true, "comma-separated typo variants match case-insensitively");
assert.equal(matchesChannelRule("PRIZING", { keyword: " pricing, prizing ", matchType: "EXACT" }), true, "exact matching trims and checks each variant");
assert.equal(findMatchingChannelKeyword("Need PRIZING please", { keyword: "pricing, prizing", matchType: "CONTAINS" }), "prizing", "returns the actual matched variant for the event log");
assert.equal(findMatchingChannelKeyword("need prize details", { keyword: "pricing, prizing", matchType: "CONTAINS" }), null, "does not log an unmatched typo variant");

const payload = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p-id" }, messages: [
  { id: "m-1", from: "15550000000", type: "text", text: { body: "Hello" } },
  { id: "m-2", from: "15550000000", type: "image", image: { id: "media" } },
] } }] }] };
assert.deepEqual(parseWhatsAppCloudMessages(payload), [{ phoneNumberId: "p-id", messageId: "m-1", sender: "15550000000", text: "Hello" }]);
assert.deepEqual(parseWhatsAppCloudMessages({ object: "instagram", entry: [] }), []);
const raw = JSON.stringify(payload);
const validSignature = `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`;
assert.equal(verifyMetaSignature(raw, validSignature, "secret"), true);
assert.equal(verifyMetaSignature(raw, validSignature, "wrong"), false);
assert.equal(verifyMetaSignature(raw, null, "secret"), false);
console.log("Meta channel automation tests passed (14 assertions)");
