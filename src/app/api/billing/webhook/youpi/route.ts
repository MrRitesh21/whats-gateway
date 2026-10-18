import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYoupiConfig, verifyYoupiWebhookSignature, parseYoupiWebhook } from "@/lib/youpi";
import { markPaymentPaidAndActivate } from "@/lib/billing";
import { logger } from "@/lib/logger";

// POST /api/billing/webhook/youpi
// Official YouPI-PG Webhook endpoint for receiving authoritative payment confirmations.
//
// Headers received from YouPI-PG:
//   X-Gateway-Signature: sha256=<hmac_hex>
//   X-Gateway-Event: SUCCESS | FAILED | EXPIRED | CANCELLED
//
// Register this webhook URL in your YouPI-PG Merchant Dashboard:
//   https://<your-domain>/api/billing/webhook/youpi
export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    const signature =
        request.headers.get("x-gateway-signature") ||
        request.headers.get("x-youpi-signature") ||
        request.headers.get("x-signature");

    const cfg = await getYoupiConfig();

    // Cryptographic signature check
    if (cfg.webhookSecret) {
        const isValid = verifyYoupiWebhookSignature(rawBody, signature, cfg.webhookSecret);
        if (!isValid) {
            logger.warn("YouPI", "Webhook signature verification failed — rejected");
            return NextResponse.json(
                { status: false, message: "Invalid webhook signature" },
                { status: 401 }
            );
        }
    } else {
        logger.warn(
            "YouPI",
            "YOUPI_WEBHOOK_SECRET is not configured. Webhook processed without signature verification."
        );
    }

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return NextResponse.json(
            { status: false, message: "Invalid JSON payload" },
            { status: 400 }
        );
    }

    const { orderId, paymentId, status, event, utr } = parseYoupiWebhook(body);
    logger.info("YouPI", `Received webhook event: ${event} for order: ${orderId}, payment: ${paymentId}`);

    if (!orderId && !paymentId) {
        return NextResponse.json(
            { status: false, message: "Missing orderId and paymentId in payload" },
            { status: 400 }
        );
    }

    // Match payment in database
    const orConditions: any[] = [];
    if (orderId) {
        orConditions.push({ id: orderId }, { reference: orderId });
    }
    if (paymentId) {
        orConditions.push({ reference: paymentId }, { id: paymentId });
    }

    const payment = await prisma.payment.findFirst({
        where: { OR: orConditions }
    });

    if (!payment) {
        logger.warn("YouPI", `Webhook received for unknown transaction: order=${orderId}, payment=${paymentId}`);
        // Return 200 to acknowledge and prevent repetitive gateway retries
        return NextResponse.json({ status: true, message: "Ignored (payment record not found)" });
    }

    try {
        if (status === "PAID") {
            // Idempotent plan upgrade and subscription activation
            await markPaymentPaidAndActivate(payment.id);

            // Store raw confirmation details including UTR
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    rawResponse: body,
                    ...(utr ? { signature: `UTR:${utr}` } : {})
                }
            }).catch(() => {});

            logger.success("YouPI", `Payment ${payment.id} marked as PAID via YouPI-PG (UTR: ${utr || "N/A"})`);
        } else if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED") {
            if (payment.status !== "PAID") {
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status,
                        rawResponse: body
                    }
                });
                logger.info("YouPI", `Payment ${payment.id} updated to status: ${status}`);
            }
        }
    } catch (e) {
        logger.error("YouPI", "Failed to process webhook event:", e);
        return NextResponse.json(
            { status: false, message: "Internal processing error" },
            { status: 500 }
        );
    }

    return NextResponse.json({ status: true, message: "Webhook processed successfully" });
}
