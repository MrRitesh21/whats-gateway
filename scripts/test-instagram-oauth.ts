import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptInstagramToken, encryptInstagramToken } from "../src/lib/instagram-token-crypto";
import { createInstagramOAuthState, verifyInstagramOAuthState } from "../src/lib/instagram-oauth-state";

const original = process.env.META_TOKEN_ENCRYPTION_KEY;
const stateExpiry = Date.now() + 60_000;
const state = createInstagramOAuthState("owner-1", "unit-test-state-secret", stateExpiry, "fixed-random-nonce");
assert.deepEqual(verifyInstagramOAuthState(state, state, "unit-test-state-secret"), { userId: "owner-1", nonce: "fixed-random-nonce", expiresAt: stateExpiry });
assert.equal(verifyInstagramOAuthState(state, "another-cookie-value", "unit-test-state-secret"), null, "cookie mismatch rejects OAuth CSRF");
assert.equal(verifyInstagramOAuthState(state, state, "wrong-secret"), null, "bad signature rejects OAuth state");
assert.equal(verifyInstagramOAuthState(state, state, "unit-test-state-secret", stateExpiry + 1), null, "expired state is rejected");
const [statePayload, stateSignature] = state.split(".");
assert.equal(verifyInstagramOAuthState(`${statePayload.slice(0, -1)}A.${stateSignature}`, state, "unit-test-state-secret"), null, "tampered state is rejected");
try {
  process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const token = `test-instagram-token-${randomBytes(12).toString("hex")}`;
  const ciphertext = encryptInstagramToken(token);
  assert.notEqual(ciphertext, token);
  assert.equal(ciphertext.includes(token), false);
  assert.equal(decryptInstagramToken(ciphertext), token);

  const pieces = ciphertext.split(":");
  pieces[2] = `${pieces[2][0] === "A" ? "B" : "A"}${pieces[2].slice(1)}`;
  assert.throws(() => decryptInstagramToken(pieces.join(":")), /authenticate|Unsupported encrypted/);

  process.env.META_TOKEN_ENCRYPTION_KEY = "invalid-key";
  assert.throws(() => encryptInstagramToken(token), /exactly 32 bytes/);
  console.log("Instagram OAuth state + token encryption: 10 checks passed");
} finally {
  if (original === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
  else process.env.META_TOKEN_ENCRYPTION_KEY = original;
}
