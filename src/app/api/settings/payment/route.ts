import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// ============================================================
// PAYMENT GATEWAY SETTINGS (UPI & YouPI-PG) — SUPERADMIN ONLY
// ============================================================

function mask(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.length <= 6) return "••••••";
    return value.slice(0, 3) + "••••" + value.slice(-3);
}

/**
 * Robustly reads SystemConfig from PostgreSQL.
 * Uses raw SQL first so any in-memory Prisma client model lag in dev mode does not drop columns.
 */
async function getSystemConfigRecord(): Promise<any> {
    try {
        const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM "SystemConfig" WHERE "id" = 'default' LIMIT 1`);
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0];
        }
    } catch (e) {
        logger.warn("Settings", "Raw query on SystemConfig failed, falling back to prisma client:", e);
    }
    return prisma.systemConfig.findUnique({ where: { id: "default" } }).catch(() => null);
}

export async function GET(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== "SUPERADMIN") {
        return NextResponse.json(
            { status: false, message: "Forbidden — SUPERADMIN only", error: "forbidden" },
            { status: 403 }
        );
    }

    const cfg = await getSystemConfigRecord();

    return NextResponse.json({
        status: true,
        data: {
            activePaymentGateway: cfg?.activePaymentGateway || "youpi",

            // Direct UPI & YouPI-PG Settings
            youpiUpiId: cfg?.youpiUpiId ?? process.env.YOUPI_UPI_ID ?? "",
            youpiPayeeName: cfg?.youpiPayeeName ?? process.env.YOUPI_PAYEE_NAME ?? "WhatsFlow",
            youpiAutoApprove: cfg?.youpiAutoApprove ?? true,

            // Advanced YouPI-PG Server Settings (Optional)
            youpiApiUrl: cfg?.youpiApiUrl || process.env.YOUPI_API_URL || "http://localhost:7000",
            youpiMerchantId: cfg?.youpiMerchantId || process.env.YOUPI_MERCHANT_ID || "",
            youpiWebhookSecretMasked: mask(cfg?.youpiWebhookSecret || process.env.YOUPI_WEBHOOK_SECRET),
            youpiWebhookSecretSet: Boolean(cfg?.youpiWebhookSecret || process.env.YOUPI_WEBHOOK_SECRET),
            youpiEnabled: cfg?.youpiEnabled ?? true,

            // KlikQRIS Gateway (Indonesia QRIS)
            klikqrisBaseUrl: cfg?.klikqrisBaseUrl || process.env.KLIKQRIS_BASE_URL || "https://klikqris.com/api",
            klikqrisMerchantId: cfg?.klikqrisMerchantId || process.env.KLIKQRIS_MERCHANT_ID || "",
            klikqrisApiKeyMasked: mask(cfg?.klikqrisApiKey || process.env.KLIKQRIS_API_KEY),
            klikqrisApiKeySet: Boolean(cfg?.klikqrisApiKey || process.env.KLIKQRIS_API_KEY),
            klikqrisEnabled: Boolean(cfg?.klikqrisEnabled)
        }
    });
}

export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== "SUPERADMIN") {
        return NextResponse.json(
            { status: false, message: "Forbidden — SUPERADMIN only", error: "forbidden" },
            { status: 403 }
        );
    }

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        /* empty body */
    }

    const {
        activePaymentGateway,
        // Direct UPI
        youpiUpiId,
        youpiPayeeName,
        youpiAutoApprove,
        // YouPI-PG Server
        youpiApiUrl,
        youpiMerchantId,
        youpiWebhookSecret,
        youpiEnabled,
        // KlikQRIS
        klikqrisBaseUrl,
        klikqrisApiKey,
        klikqrisMerchantId,
        klikqrisEnabled
    } = body;

    // Read current existing config to prevent unintentional overrides
    const current = await getSystemConfigRecord();

    const targetGateway = activePaymentGateway !== undefined ? String(activePaymentGateway).trim() : (current?.activePaymentGateway || "youpi");
    const targetUpiId = youpiUpiId !== undefined ? String(youpiUpiId).trim() : (current?.youpiUpiId || "");
    const targetPayeeName = youpiPayeeName !== undefined ? String(youpiPayeeName).trim() : (current?.youpiPayeeName || "WhatsFlow");
    const targetAutoApprove = youpiAutoApprove !== undefined ? Boolean(youpiAutoApprove) : (current?.youpiAutoApprove ?? true);
    const targetApiUrl = youpiApiUrl !== undefined ? String(youpiApiUrl).trim() : (current?.youpiApiUrl || "http://localhost:7000");
    const targetMerchantId = youpiMerchantId !== undefined ? String(youpiMerchantId).trim() : (current?.youpiMerchantId || "");
    const targetEnabled = youpiEnabled !== undefined ? Boolean(youpiEnabled) : (current?.youpiEnabled ?? true);

    const targetKlikBaseUrl = klikqrisBaseUrl !== undefined ? String(klikqrisBaseUrl).trim() : (current?.klikqrisBaseUrl || "https://klikqris.com/api");
    const targetKlikMerchantId = klikqrisMerchantId !== undefined ? String(klikqrisMerchantId).trim() : (current?.klikqrisMerchantId || "");
    const targetKlikEnabled = klikqrisEnabled !== undefined ? Boolean(klikqrisEnabled) : (current?.klikqrisEnabled ?? false);

    const targetSecret = typeof youpiWebhookSecret === "string" && youpiWebhookSecret.trim() !== ""
        ? youpiWebhookSecret.trim()
        : (current?.youpiWebhookSecret ?? null);

    const targetApiKey = typeof klikqrisApiKey === "string" && klikqrisApiKey.trim() !== ""
        ? klikqrisApiKey.trim()
        : (current?.klikqrisApiKey ?? null);

    try {
        await prisma.$executeRawUnsafe(
            `INSERT INTO "SystemConfig" (
                "id", "activePaymentGateway", "youpiUpiId", "youpiPayeeName", "youpiAutoApprove",
                "youpiApiUrl", "youpiMerchantId", "youpiWebhookSecret", "youpiEnabled",
                "klikqrisBaseUrl", "klikqrisApiKey", "klikqrisMerchantId", "klikqrisEnabled", "updatedAt"
             )
             VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             ON CONFLICT ("id") DO UPDATE SET
               "activePaymentGateway" = EXCLUDED."activePaymentGateway",
               "youpiUpiId" = EXCLUDED."youpiUpiId",
               "youpiPayeeName" = EXCLUDED."youpiPayeeName",
               "youpiAutoApprove" = EXCLUDED."youpiAutoApprove",
               "youpiApiUrl" = EXCLUDED."youpiApiUrl",
               "youpiMerchantId" = EXCLUDED."youpiMerchantId",
               "youpiWebhookSecret" = COALESCE(EXCLUDED."youpiWebhookSecret", "SystemConfig"."youpiWebhookSecret"),
               "youpiEnabled" = EXCLUDED."youpiEnabled",
               "klikqrisBaseUrl" = EXCLUDED."klikqrisBaseUrl",
               "klikqrisApiKey" = COALESCE(EXCLUDED."klikqrisApiKey", "SystemConfig"."klikqrisApiKey"),
               "klikqrisMerchantId" = EXCLUDED."klikqrisMerchantId",
               "klikqrisEnabled" = EXCLUDED."klikqrisEnabled",
               "updatedAt" = NOW()`,
            targetGateway,
            targetUpiId,
            targetPayeeName,
            targetAutoApprove,
            targetApiUrl,
            targetMerchantId || null,
            targetSecret,
            targetEnabled,
            targetKlikBaseUrl,
            targetApiKey,
            targetKlikMerchantId || null,
            targetKlikEnabled
        );
    } catch (dbErr) {
        logger.error("Settings", "Failed to upsert SystemConfig via raw SQL:", dbErr);
        // Fallback to prisma upsert
        try {
            await prisma.systemConfig.upsert({
                where: { id: "default" },
                update: {
                    activePaymentGateway: targetGateway,
                    youpiUpiId: targetUpiId,
                    youpiPayeeName: targetPayeeName,
                    youpiAutoApprove: targetAutoApprove,
                    youpiApiUrl: targetApiUrl,
                    youpiMerchantId: targetMerchantId || null,
                    youpiWebhookSecret: targetSecret,
                    youpiEnabled: targetEnabled,
                    klikqrisBaseUrl: targetKlikBaseUrl,
                    klikqrisMerchantId: targetKlikMerchantId || null,
                    klikqrisApiKey: targetApiKey,
                    klikqrisEnabled: targetKlikEnabled
                } as any,
                create: {
                    id: "default",
                    activePaymentGateway: targetGateway,
                    youpiUpiId: targetUpiId,
                    youpiPayeeName: targetPayeeName,
                    youpiAutoApprove: targetAutoApprove,
                    youpiApiUrl: targetApiUrl,
                    youpiMerchantId: targetMerchantId || null,
                    youpiWebhookSecret: targetSecret,
                    youpiEnabled: targetEnabled,
                    klikqrisBaseUrl: targetKlikBaseUrl,
                    klikqrisMerchantId: targetKlikMerchantId || null,
                    klikqrisApiKey: targetApiKey,
                    klikqrisEnabled: targetKlikEnabled
                } as any
            });
        } catch (fallbackErr) {
            logger.error("Settings", "Prisma upsert fallback failed:", fallbackErr);
            return NextResponse.json(
                { status: false, message: "Failed to save payment settings", error: "db_error" },
                { status: 500 }
            );
        }
    }

    const saved = await getSystemConfigRecord();

    return NextResponse.json({
        status: true,
        message: "Payment settings saved successfully",
        data: {
            activePaymentGateway: saved?.activePaymentGateway || targetGateway,
            youpiUpiId: saved?.youpiUpiId ?? targetUpiId,
            youpiPayeeName: saved?.youpiPayeeName ?? targetPayeeName,
            youpiAutoApprove: saved?.youpiAutoApprove ?? targetAutoApprove,
            youpiApiUrl: saved?.youpiApiUrl || targetApiUrl,
            youpiMerchantId: saved?.youpiMerchantId || "",
            youpiWebhookSecretSet: Boolean(saved?.youpiWebhookSecret || targetSecret),
            youpiEnabled: saved?.youpiEnabled ?? targetEnabled,
            klikqrisBaseUrl: saved?.klikqrisBaseUrl || targetKlikBaseUrl,
            klikqrisMerchantId: saved?.klikqrisMerchantId || "",
            klikqrisApiKeySet: Boolean(saved?.klikqrisApiKey || targetApiKey),
            klikqrisEnabled: saved?.klikqrisEnabled ?? targetKlikEnabled
        }
    });
}
