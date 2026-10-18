// ============================================================
// BOOTSTRAP — WebotApp WhatsGateway Enterprise Auto-Starter
// ------------------------------------------------------------
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

function ensureEnvFile() {
    const envPath = path.resolve(process.cwd(), ".env");
    const examplePath = path.resolve(process.cwd(), ".env.example");
    if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
        try {
            let content = fs.readFileSync(examplePath, "utf8");
            const secret = crypto.randomBytes(32).toString("base64");
            content = content.replace("your-super-secret-key-at-least-32-chars-change-this-in-production", secret);
            fs.writeFileSync(envPath, content, "utf8");
            console.log("⚡ Auto-initialized .env from .env.example with secure AUTH_SECRET");
        } catch {
            /* ignore */
        }
    }
}

function loadEnvFile(file: string) {
    try {
        const p = path.resolve(process.cwd(), file);
        if (!fs.existsSync(p)) return;
        const content = fs.readFileSync(p, "utf8");
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq === -1) continue;
            const key = line.slice(0, eq).trim();
            if (!key || process.env[key] !== undefined) continue;
            let val = line.slice(eq + 1).trim();
            val = val.replace(/^["'](.*)["']$/, "$1");
            process.env[key] = val;
        }
    } catch {
        /* ignore */
    }
}

ensureEnvFile();
loadEnvFile(".env.local");
loadEnvFile(".env");

// Auto-provision database tables and default admin if database is accessible
async function autoProvision() {
    if (!process.env.DATABASE_URL) return;
    try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        
        let needsPush = false;
        try {
            await prisma.user.findFirst();
        } catch {
            needsPush = true;
        }

        if (needsPush) {
            console.log("⚡ [Auto-Setup] Initializing database tables automatically...");
            const { execSync } = await import("child_process");
            try {
                execSync("npx prisma db push --skip-generate", { stdio: "pipe" });
                console.log("✅ [Auto-Setup] Database tables created successfully!");
            } catch (err: any) {
                console.warn("⚠️ [Auto-Setup] Schema push warning:", err?.message || err);
            }
        }

        // Ensure default superadmin
        try {
            const admin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
            if (!admin) {
                const bcryptModule = await import("bcryptjs");
                const bcrypt = (bcryptModule as any).default || bcryptModule;
                const hashedPassword = await bcrypt.hash("admin123", 10);
                await prisma.user.create({
                    data: {
                        email: "admin@example.com",
                        name: "Super Admin",
                        password: hashedPassword,
                        role: "SUPERADMIN"
                    }
                });
                console.log("✅ [Auto-Setup] Default SuperAdmin created: admin@example.com / admin123");
            }
        } catch {
            /* ignore */
        } finally {
            await prisma.$disconnect();
        }
    } catch {
        /* deferred */
    }
}

autoProvision().finally(() => {
    import("./index.js").catch((e) => {
        console.error("Gagal start server:", e);
        process.exit(1);
    });
});
