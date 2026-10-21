import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { matchesChannelRule, parseWhatsAppCloudMessages, verifyMetaSignature } from "../src/lib/channel-automation";

assert.equal(matchesChannelRule("I need pricing details", { keyword: "pricing", matchType: "CONTAINS" }), true);
assert.equal(matchesChannelRule("PRICE", { keyword: "price", matchType: "EXACT" }), true);
assert.equal(matchesChannelRule("Price please", { keyword: "price", matchType: "STARTS_WITH" }), true);
assert.equal(matchesChannelRule("Order 42", { keyword: "\\d+", matchType: "REGEX" }), true);
assert.equal(matchesChannelRule("anything", { keyword: "[", matchType: "REGEX" }), false);

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
console.log("Meta channel automation tests passed (11 assertions)");
