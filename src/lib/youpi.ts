import crypto from "crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";

// ============================================================
// YOUPI PAYMENT GATEWAY CLIENT (YouPI-PG & Direct UPI)
// ------------------------------------------------------------
// Supports:
// 1. Direct UPI Mode (Zero setup — just enter your receiving UPI ID / VPA)
//    Instantly generates dynamic UPI QR codes and 1-tap app switch intents
//    (GPay, PhonePe, Paytm, CRED, BHIM) with instant 12-digit UTR confirmation.
// 2. Full YouPI-PG Server Mode (Automated Bank Observers & WhatsApp OTP)
//    Connects with self-hosted YouPI-PG server instance and handles
//    HMAC-SHA256 authoritative webhooks.
// ============================================================

export type NormalizedPaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "CANCELLED";

export interface YoupiConfig {
    upiId: string;
    payeeName: string;
    apiUrl: string;
    merchantId: string;
    webhookSecret: string;
    autoApprove: boolean;
    enabled: boolean;
}

/**
 * Retrieve YouPI / UPI configuration with Database priority and ENV fallback.
 * Uses raw SQL first so in-memory Prisma client model lag does not drop fields.
 */
export async function getYoupiConfig(): Promise<YoupiConfig> {
    let upiId = process.env.YOUPI_UPI_ID || "";
    let payeeName = process.env.YOUPI_PAYEE_NAME || "WhatsFlow";
    let apiUrl = process.env.YOUPI_API_URL || "http://localhost:7000";
    let merchantId = process.env.YOUPI_MERCHANT_ID || "";
    let webhookSecret = process.env.YOUPI_WEBHOOK_SECRET || "";
    let autoApprove = true;
    let enabled = true;

    try {
        let cfg: any = null;
        try {
            const rows: any = await prisma.$queryRawUnsafe(`SELECT * FROM "SystemConfig" WHERE "id" = 'default' LIMIT 1`);
            if (Array.isArray(rows) && rows.length > 0) {
                cfg = rows[0];
            }
        } catch {
            cfg = await prisma.systemConfig.findUnique({ where: { id: "default" } }).catch(() => null);
        }

        if (cfg) {
            if (cfg.youpiUpiId !== undefined && cfg.youpiUpiId !== null) upiId = cfg.youpiUpiId;
            if (cfg.youpiPayeeName) payeeName = cfg.youpiPayeeName;
            if (cfg.youpiApiUrl) apiUrl = cfg.youpiApiUrl;
            if (cfg.youpiMerchantId) merchantId = cfg.youpiMerchantId;
            if (cfg.youpiWebhookSecret) webhookSecret = cfg.youpiWebhookSecret;
            if (typeof cfg.youpiAutoApprove === "boolean") autoApprove = cfg.youpiAutoApprove;
            if (typeof cfg.youpiEnabled === "boolean") enabled = cfg.youpiEnabled;
        }
    } catch (e) {
        logger.warn("YouPI", "Failed to read config from DB, using ENV:", e);
    }

    return {
        upiId: upiId.trim(),
        payeeName: payeeName.trim() || "WhatsFlow",
        apiUrl: apiUrl.replace(/\/$/, ""),
        merchantId: merchantId.trim(),
        webhookSecret: webhookSecret.trim(),
        autoApprove,
        enabled
    };
}

export async function isYoupiConfigured(): Promise<boolean> {
    const c = await getYoupiConfig();
    return Boolean(c.enabled && (c.upiId || (c.apiUrl && c.merchantId)));
}

export interface CreateYoupiPaymentInput {
    orderId: string;
    amount: number; // In INR (₹)
    currency?: string; // Default: "INR"
    customer?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    returnUrl?: string;
    metadata?: Record<string, any>;
}

export interface CreateYoupiPaymentResult {
    reference: string;
    paymentId: string;
    checkoutUrl: string | null;
    qrString: string | null;
    qrImageUrl: string | null;
    totalAmount: number;
    expiresAt: Date | null;
    raw: any;
}

/**
 * Builds a standard NPCI dynamic UPI payment URI.
 * Works seamlessly across Google Pay, PhonePe, Paytm, CRED, BHIM.
 */
export function buildDirectUpiUri(input: {
    upiId: string;
    payeeName: string;
    amount: number;
    orderId: string;
    description?: string;
}): string {
    const pa = encodeURIComponent(input.upiId);
    const pn = encodeURIComponent(input.payeeName || "Merchant");
    const am = input.amount.toFixed(2);
    const tr = encodeURIComponent(input.orderId);
    const tn = encodeURIComponent(input.description || `Plan upgrade ${input.orderId.slice(-6)}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;
}

/**
 * Normalize outcome/event into internal PaymentStatus.
 */
export function normalizeYoupiStatus(raw: string | undefined | null): NormalizedPaymentStatus {
    const s = String(raw || "").trim().toUpperCase();
    if (["SUCCESS", "PAID", "COMPLETED", "SETTLED"].includes(s)) return "PAID";
    if (["EXPIRED", "TIMEOUT"].includes(s)) return "EXPIRED";
    if (["CANCELLED", "CANCELED", "ABORTED"].includes(s)) return "CANCELLED";
    if (["FAILED", "REJECTED", "ERROR"].includes(s)) return "FAILED";
    return "PENDING";
}

/**
 * Create a new payment session.
 * 1. If direct UPI ID is configured, immediately constructs dynamic UPI URI.
 * 2. If YouPI-PG server is also configured, contacts server in parallel for observer registration.
 */
export async function createYoupiPayment(input: CreateYoupiPaymentInput): Promise<CreateYoupiPaymentResult> {
    const cfg = await getYoupiConfig();
    if (!cfg.upiId && (!cfg.apiUrl || !cfg.merchantId)) {
        throw new Error("Please configure your receiving UPI ID in Dashboard Settings > Payment Gateway");
    }

    // Default dynamic UPI string based on direct UPI ID
    let fallbackQrString: string | null = null;
    if (cfg.upiId) {
        fallbackQrString = buildDirectUpiUri({
            upiId: cfg.upiId,
            payeeName: cfg.payeeName,
            amount: input.amount,
            orderId: input.orderId,
            description: input.metadata?.plan ? `Upgrade ${input.metadata.plan}` : undefined
        });
    }

    // Default 15-minute payment window
    const defaultExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // If YouPI-PG server credentials are also provided, try server session
    if (cfg.apiUrl && cfg.merchantId) {
        const url = `${cfg.apiUrl}/api/v1/payments`;
        const payload = {
            orderId: input.orderId,
            amount: Number(input.amount.toFixed(2)),
            currency: input.currency || "INR",
            customer: input.customer,
            returnUrl: input.returnUrl,
            metadata: input.metadata || {}
        };

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Merchant-Id": cfg.merchantId
                },
                body: JSON.stringify(payload),
                cache: "no-store",
                signal: AbortSignal.timeout(4000)
            });

            if (res.ok) {
                const text = await res.text();
                let json: any;
                try {
                    json = JSON.parse(text);
                } catch {
                    json = { _raw: text };
                }

                const data = json?.data || json;
                const paymentId = String(data.paymentId || data.id || input.orderId);
                let checkoutUrl = data.checkoutUrl || data.checkout_url || null;

                if (checkoutUrl && !checkoutUrl.startsWith("http://") && !checkoutUrl.startsWith("https://")) {
                    checkoutUrl = `${cfg.apiUrl}${checkoutUrl.startsWith("/") ? "" : "/"}${checkoutUrl}`;
                }

                return {
                    reference: paymentId,
                    paymentId,
                    checkoutUrl,
                    qrString: data.qrString || data.qr_string || data.upiUri || data.upi_uri || fallbackQrString,
                    qrImageUrl: data.qrImageUrl || data.qr_image_url || null,
                    totalAmount: data.amount ? Number(data.amount) : input.amount,
                    expiresAt: data.expiresAt ? new Date(data.expiresAt) : defaultExpiry,
                    raw: json
                };
            }
        } catch (e: any) {
            logger.warn("YouPI", "YouPI-PG server unreachable, falling back to direct UPI:", e?.message);
        }
    }

    // Direct UPI Mode fallback
    return {
        reference: input.orderId,
        paymentId: input.orderId,
        checkoutUrl: null,
        qrString: fallbackQrString,
        qrImageUrl: null,
        totalAmount: input.amount,
        expiresAt: defaultExpiry,
        raw: { mode: "direct_upi", upiId: cfg.upiId, payeeName: cfg.payeeName }
    };
}

/**
 * Check payment status on YouPI-PG server (GET /api/v1/payments/{id}).
 */
export async function checkYoupiPaymentStatus(
    paymentOrOrderId: string
): Promise<{ status: NormalizedPaymentStatus; utr?: string; raw: any }> {
    const cfg = await getYoupiConfig();
    if (!cfg.apiUrl || !cfg.merchantId) {
        return { status: "PENDING", raw: { directUpi: true } };
    }

    const url = `${cfg.apiUrl}/api/v1/payments/${encodeURIComponent(paymentOrOrderId)}`;
    let json: any;
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "X-Merchant-Id": cfg.merchantId
            },
            cache: "no-store",
            signal: AbortSignal.timeout(3000)
        });

        const text = await res.text();
        try {
            json = JSON.parse(text);
        } catch {
            json = { _raw: text };
        }
    } catch {
        return { status: "PENDING", raw: null };
    }

    const data = json?.data || json;
    const rawStatus = data?.event || data?.status || data?.paymentStatus;
    const utr = data?.utr || data?.bankReference;

    return {
        status: normalizeYoupiStatus(rawStatus),
        utr,
        raw: json
    };
}

/**
 * Cryptographically verify incoming webhook signature from YouPI-PG.
 */
export function verifyYoupiWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string | null | undefined,
    secret: string
): boolean {
    if (!signatureHeader || !secret) {
        return false;
    }

    try {
        const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
        const expectedWithPrefix = `sha256=${expectedHex}`;

        const incoming = signatureHeader.trim();
        const incomingClean = incoming.startsWith("sha256=") ? incoming.slice(7) : incoming;

        const bufA = Buffer.from(incomingClean, "utf8");
        const bufB = Buffer.from(expectedHex, "utf8");

        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
            return true;
        }

        const bufA2 = Buffer.from(incoming, "utf8");
        const bufB2 = Buffer.from(expectedWithPrefix, "utf8");

        return bufA2.length === bufB2.length && crypto.timingSafeEqual(bufA2, bufB2);
    } catch {
        return false;
    }
}

/**
 * Parse YouPI webhook payload.
 */
export function parseYoupiWebhook(body: any): {
    orderId: string | null;
    paymentId: string | null;
    event: string;
    status: NormalizedPaymentStatus;
    amount: number | null;
    utr: string | null;
} {
    const event = String(body?.event || body?.status || "UNKNOWN").toUpperCase();
    const orderId = body?.orderId || body?.order_id || body?.metadata?.orderId || null;
    const paymentId = body?.paymentId || body?.payment_id || null;
    const utr = body?.utr || body?.bank_reference || null;

    let amount: number | null = null;
    if (body?.amount !== undefined) {
        amount = Number(body.amount);
    } else if (body?.amountPaise !== undefined) {
        amount = Number(body.amountPaise) / 100;
    }

    return {
        orderId: orderId ? String(orderId) : null,
        paymentId: paymentId ? String(paymentId) : null,
        event,
        status: normalizeYoupiStatus(event),
        amount,
        utr: utr ? String(utr) : null
    };
}
