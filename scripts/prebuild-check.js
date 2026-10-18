// Pre-build check: Auto-initialize .env from .env.example if missing
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.resolve(process.cwd(), ".env");
const examplePath = path.resolve(process.cwd(), ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  console.log("⚡ [Build] .env not found. Auto-generating from .env.example...");
  let content = fs.readFileSync(examplePath, "utf8");
  const secret = crypto.randomBytes(32).toString("base64");
  content = content.replace("your-super-secret-key-at-least-32-chars-change-this-in-production", secret);
  fs.writeFileSync(envPath, content, "utf8");
  console.log("✅ [Build] .env initialized successfully with secure AUTH_SECRET.");
}
