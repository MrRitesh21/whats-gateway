// Auto-setup script: Initializes database tables & creates default admin
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("ℹ️ [Auto-Setup] DATABASE_URL not set yet in .env, skipping schema sync.");
    return;
  }

  console.log("⚡ [Auto-Setup] Checking database and tables...");
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    
    let needsPush = false;
    try {
      await prisma.user.findFirst();
    } catch (e) {
      needsPush = true;
    }

    if (needsPush) {
      console.log("⚡ [Auto-Setup] Synchronizing database tables automatically...");
      execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
      console.log("✅ [Auto-Setup] All database tables created!");
    }

    // Ensure default superadmin exists
    const admin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    if (!admin) {
      console.log("⚡ [Auto-Setup] Creating default Superadmin (admin@example.com)...");
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await prisma.user.create({
        data: {
          email: "admin@example.com",
          name: "Super Admin",
          password: hashedPassword,
          role: "SUPERADMIN"
        }
      });
      console.log("✅ [Auto-Setup] Superadmin created: admin@example.com / admin123");
    } else {
      console.log("✅ [Auto-Setup] Superadmin user ready.");
    }

    await prisma.$disconnect();
  } catch (err) {
    console.warn("ℹ️ [Auto-Setup] DB connection deferred: " + (err.message || err));
  }
}

run();
