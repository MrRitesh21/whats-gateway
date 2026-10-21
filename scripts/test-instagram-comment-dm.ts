import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  constantTimeEqual,
  findInstagramKeyword,
  parseInstagramCommentEvents,
  redactInstagramError,
  verifyInstagramWebhookSignature,
} from "../src/lib/instagram-comment-dm";

const payload = {
  object: "instagram",
  entry: [
    {
      id: "ig-account-1",
      changes: [
        { field: "comments", value: { id: "comment-1", text: "GET the LINK!", from: { id: "user-1", username: "alice" }, media: { id: "media-1" } } },
        { field: "comments", value: { comment_id: "comment-2", text: "link typo", from: { id: "user-2" }, media_id: "media-2" } },
        { field: "comments", value: { id: "own-comment", text: "LINK", from: { id: "ig-account-1" }, media: { id: "media-1" } } },
        { field: "comments", value: { id: "missing-media", text: "LINK", from: { id: "user-3" } } },
        { field: "mentions", value: { id: "not-a-comment" } },
      ],
    },
  ],
};
const events = parseInstagramCommentEvents(payload);
assert.equal(events.length, 2, "accept valid comment fields, skip self comments and malformed/non-comment events");
assert.deepEqual(events[0], {
  instagramAccountId: "ig-account-1",
  commentId: "comment-1",
  commentText: "GET the LINK!",
  commenterId: "user-1",
  username: "alice",
  mediaId: "media-1",
});
assert.equal(events[1].commentId, "comment-2", "accept alternate comment_id/media_id event shape");
assert.equal(parseInstagramCommentEvents({ object: "page", entry: payload.entry }).length, 0);
assert.equal(findInstagramKeyword("Please send the LINK!", ["link"]), "link");
assert.equal(findInstagramKeyword("we need a LINK NOW", ["LINK", "link typo"]), "LINK");
assert.equal(findInstagramKeyword("link typo please", ["link typo"]), "link typo");
assert.equal(findInstagramKeyword("blink is not the keyword", ["link"]), null, "whole-word matcher avoids substring false positives");
const rawBody = JSON.stringify(payload);
const signature = `sha256=${createHmac("sha256", "test-app-secret").update(rawBody).digest("hex")}`;
assert.equal(verifyInstagramWebhookSignature(rawBody, signature, "test-app-secret"), true);
assert.equal(verifyInstagramWebhookSignature(rawBody, signature, "wrong-secret"), false);
assert.equal(verifyInstagramWebhookSignature(rawBody, "sha1=not-valid", "test-app-secret"), false);
assert.equal(constantTimeEqual("same", "same"), true);
assert.equal(constantTimeEqual("same", "different"), false);
assert.equal(redactInstagramError("Authorization: Bearer topsecret"), "Authorization: Bearer [REDACTED]");
console.log("Instagram lightweight integration: 14 checks passed");
