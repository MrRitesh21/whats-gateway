import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCallbackSignature, parseCallback } from "@/lib/klikqris";
import { getYoupiConfig, verifyYoupiWebhookSignature, parseYoupiWebhook } from "@/lib/youpi";
import { markPaymentPaidAndActivate } from "@/lib/billing";
import { logger } from "@/lib/logger";

// POST /api/billing/callback
// Unified webhook callback endpoint supporting both KlikQRIS and YouPI-PG.
export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ status: false, message: "Invalid JSON" }, { status: 400 });
    }

    const youpiSignature =
        request.headers.get("x-gateway-signature") ||
        request.headers.get("x-youpi-signature");

    // 1. If YouPI-PG signature header is present, handle via YouPI logic
    if (youpiSignature) {
        const cfg = await getYoupiConfig();
        if (cfg.webhookSecret && !verifyYoupiWebhookSignature(rawBody, youpiSignature, cfg.webhookSecret)) {
            logger.warn("YouPI", "Webhook callback signature invalid — rejected");
            return NextResponse.json({ status: false, message: "Invalid signature" }, { status: 401 });
        }

        const youpiData = parseYoupiWebhook(body);
        const orderId = youpiData.orderId || youpiData.paymentId;
        if (!orderId) {
            return NextResponse.json({ status: false, message: "Missing orderId" }, { status: 400 });
        }

        const payment = await prisma.payment.findFirst({
            where: { OR: [{ id: orderId }, { reference: orderId }] }
        });

        if (!payment) {
            return NextResponse.json({ status: true, message: "Ignored (unknown order)" });
        }

        if (youpiData.status === "PAID") {
            await markPaymentPaidAndActivate(payment.id);
        } else if (["EXPIRED", "FAILED", "CANCELLED"].includes(youpiData.status)) {
            if (payment.status !== "PAID") {
                await prisma.payment.update({ where: { id: payment.id }, data: { status: youpiData.status } });
            }
        }
        return NextResponse.json({ status: true, message: "OK" });
    }

    // 2. Otherwise handle KlikQRIS callback
    const { orderId, status, signature } = parseCallback(body);
    if (!orderId) {
        return NextResponse.json({ status: false, message: "Missing order_id" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({
        where: { OR: [{ id: orderId }, { reference: orderId }] }
    });

    if (!payment) {
        logger.warn("Billing", `Callback for unknown order_id: ${orderId}`);
        return NextResponse.json({ status: true, message: "Ignored (unknown order)" });
    }

    // Check if payment was made via YouPI or KlikQRIS
    if (payment.provider === "youpi") {
        const youpiData = parseYoupiWebhook(body);
        if (youpiData.status === "PAID") {
            await markPaymentPaidAndActivate(payment.id);
        } else if (["EXPIRED", "FAILED", "CANCELLED"].includes(youpiData.status)) {
            if (payment.status !== "PAID") {
                await prisma.payment.update({ where: { id: payment.id }, data: { status: youpiData.status } });
            }
        }
        return NextResponse.json({ status: true, message: "OK" });
    }

    // Validate KlikQRIS signature against stored signature
    if (!verifyCallbackSignature(signature, payment.signature)) {
        logger.warn("Billing", `KlikQRIS signature mismatch for order ${orderId} — rejected`);
        return NextResponse.json({ status: false, message: "Invalid signature" }, { status: 401 });
    }

    try {
        if (status === "PAID") {
            await markPaymentPaidAndActivate(payment.id);
        } else if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED") {
            if (payment.status !== "PAID") {
                await prisma.payment.update({ where: { id: payment.id }, data: { status } });
            }
        }
    } catch (e) {
        logger.error("Billing", "Failed to process callback:", e);
        return NextResponse.json({ status: false, message: "Processing error" }, { status: 500 });
    }

    return NextResponse.json({ status: true, message: "OK" });
}
