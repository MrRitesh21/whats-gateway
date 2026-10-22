import assert from "node:assert/strict";
import { resolveSessionSystemInstructions } from "../src/lib/ai-gateway/session-persona";

const ragConfig = {
  systemInstructions: "Shared default persona",
  sessionSystemInstructions: {
    "session-alpha": "Persona for Alpha",
    "session-empty": "   ",
  },
};
assert.equal(resolveSessionSystemInstructions(ragConfig, "session-alpha"), "Persona for Alpha");
assert.equal(resolveSessionSystemInstructions(ragConfig, "session-beta"), "Shared default persona");
assert.equal(resolveSessionSystemInstructions(ragConfig, "session-empty"), "Shared default persona");
assert.equal(resolveSessionSystemInstructions(ragConfig), "Shared default persona");
console.log("Session persona resolution checks passed");
