import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPlanConfig, type PlanId } from "@/lib/plans";
import { createQrisTransaction, isKlikQrisConfigured } from "@/lib/klikqris";
import { createYoupiPayment, isYoupiConfigured } from "@/lib/youpi";
import { logger } from "@/lib/logger";

// POST /api/billing/checkout  { plan: "STANDARD" | "PRO", provider?: "youpi" | "klikqris" }
// Initializes checkout with YouPI-PG (UPI India) or KlikQRIS (Indonesia) and returns payment parameters.
export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        return NextResponse.json(
            { status: false, message: "Unauthorized", error: "Unauthorized" },
            { status: 401 }
        );
    }

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        /* optional body */
    }

    const planId = String(body?.plan || "").toUpperCase() as PlanId;
    const cfg = getPlanConfig(planId);

    if (!planId || cfg.id !== planId) {
        return NextResponse.json(
            { status: false, message: "Invalid plan selected", error: "invalid_plan" },
            { status: 400 }
        );
    }

    if (planId === "FREE") {
        return NextResponse.json(
            { status: false, message: "Free plan does not require payment", error: "free_plan" },
            { status: 400 }
        );
    }

    if (cfg.price === null) {
        return NextResponse.json(
            {
                status: false,
                message: "This plan is custom. Please contact support or sales.",
                error: "custom_plan"
            },
            { status: 400 }
        );
    }

    const youpiAvailable = await isYoupiConfigured();
    const klikqrisAvailable = await isKlikQrisConfigured();

    // Determine active provider
    let provider = body?.provider ? String(body.provider).toLowerCase() : "";
    if (!provider) {
        const sysConfig: any = await prisma.systemConfig.findUnique({ where: { id: "default" } }).catch(() => null);
        if (sysConfig?.activePaymentGateway === "klikqris" && klikqrisAvailable) {
            provider = "klikqris";
        } else if (youpiAvailable) {
            provider = "youpi";
        } else if (klikqrisAvailable) {
            provider = "klikqris";
        }
    }

    if (provider === "youpi" && !youpiAvailable && klikqrisAvailable) {
        provider = "klikqris";
    } else if (provider === "klikqris" && !klikqrisAvailable && youpiAvailable) {
        provider = "youpi";
    }

    if (!provider || (provider === "youpi" && !youpiAvailable) || (provider === "klikqris" && !klikqrisAvailable)) {
        return NextResponse.json(
            {
                status: false,
                message: "Payment gateway has not been configured or enabled by administrator.",
                error: "gateway_not_configured"
            },
            { status: 503 }
        );
    }

    // Create preliminary Payment record (PENDING)
    const payment = await prisma.payment.create({
        data: {
            userId: user.id,
            plan: planId,
            amount: cfg.price,
            durationDays: cfg.durationDays,
            status: "PENDING",
            provider
        }
    });

    try {
        if (provider === "youpi") {
            const origin = request.headers.get("origin") || request.nextUrl.origin;
            const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL || origin;

            const trx = await createYoupiPayment({
                orderId: payment.id,
                amount: cfg.price,
                currency: "INR",
                customer: {
                    name: user.name || "Subscriber",
                    email: user.email
                },
                returnUrl: `${baseUrl}/dashboard/billing?paymentId=${payment.id}`,
                metadata: {
                    userId: user.id,
                    plan: planId
                }
            });

            const rawData = {
                ...(typeof trx.raw === "object" && trx.raw ? trx.raw : {}),
                checkoutUrl: trx.checkoutUrl
            };

            const updated: any = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    reference: trx.reference,
                    qrString: trx.qrString,
                    qrImageUrl: trx.qrImageUrl,
                    totalAmount: trx.totalAmount ?? cfg.price,
                    expiresAt: trx.expiresAt,
                    rawResponse: rawData
                }
            });

            return NextResponse.json({
                status: true,
                message: "Please complete your payment via UPI QR or checkout link",
                data: {
                    paymentId: updated.id,
                    reference: updated.reference,
                    plan: planId,
                    planName: cfg.name,
                    amount: cfg.price,
                    totalAmount: updated.totalAmount,
                    currency: "INR",
                    provider: "youpi",
                    checkoutUrl: trx.checkoutUrl,
                    qrString: updated.qrString,
                    qrImageUrl: updated.qrImageUrl,
                    expiresAt: updated.expiresAt
                }
            });
        }

        // Provider KlikQRIS (Indonesia)
        const trx = await createQrisTransaction({
            amount: cfg.price,
            orderId: payment.id,
            description: `Upgrade plan ${cfg.name} (${user.email})`
        });

        const updated = await prisma.payment.update({
            where: { id: payment.id },
            data: {
                reference: trx.reference,
                signature: trx.signature,
                totalAmount: trx.totalAmount ?? cfg.price,
                qrImageUrl: trx.qrImageUrl,
                expiresAt: trx.expiresAt,
                rawResponse: trx.raw ?? undefined
            }
        });

        return NextResponse.json({
            status: true,
            message: "Silakan scan QRIS untuk membayar",
            data: {
                paymentId: updated.id,
                reference: updated.reference,
                plan: planId,
                planName: cfg.name,
                amount: cfg.price,
                totalAmount: updated.totalAmount,
                currency: "IDR",
                provider: "klikqris",
                qrString: updated.qrString,
                qrImageUrl: updated.qrImageUrl,
                expiresAt: updated.expiresAt
            }
        });
    } catch (e: any) {
        logger.error("Billing", "Checkout error:", e);
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED" }
        }).catch(() => {});
        return NextResponse.json(
            { status: false, message: e?.message || "Failed to create transaction", error: "checkout_failed" },
            { status: 502 }
        );
    }
}
