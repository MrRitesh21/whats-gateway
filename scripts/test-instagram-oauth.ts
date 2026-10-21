import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptInstagramToken, encryptInstagramToken } from "../src/lib/instagram-token-crypto";

const original = process.env.META_TOKEN_ENCRYPTION_KEY;
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
  console.log("Instagram OAuth token encryption: 4 checks passed");
} finally {
  if (original === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
  else process.env.META_TOKEN_ENCRYPTION_KEY = original;
}
