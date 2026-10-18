import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { checkQrisStatus } from "@/lib/klikqris";
import { checkYoupiPaymentStatus } from "@/lib/youpi";
import { markPaymentPaidAndActivate } from "@/lib/billing";
import { logger } from "@/lib/logger";

// GET /api/billing/status/[id] — check payment status (UI polling fallback)
// Checks DB state and queries active gateway (YouPI-PG or KlikQRIS) in case webhook was delayed.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        return NextResponse.json(
            { status: false, message: "Unauthorized", error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { id } = await params;
    const payment = await prisma.payment.findUnique({ where: { id } });

    if (!payment || (payment.userId !== user.id && user.role !== "SUPERADMIN")) {
        return NextResponse.json(
            { status: false, message: "Payment not found", error: "not_found" },
            { status: 404 }
        );
    }

    // If still pending & has reference, query gateway directly
    if (payment.status === "PENDING" && payment.reference) {
        try {
            if (payment.provider === "youpi") {
                const { status, utr } = await checkYoupiPaymentStatus(payment.reference || payment.id);
                if (status === "PAID") {
                    await markPaymentPaidAndActivate(payment.id);
                    if (utr) {
                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: { signature: `UTR:${utr}` }
                        }).catch(() => {});
                    }
                } else if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED") {
                    await prisma.payment.update({ where: { id: payment.id }, data: { status } });
                }
            } else {
                const { status } = await checkQrisStatus(payment.reference);
                if (status === "PAID") {
                    await markPaymentPaidAndActivate(payment.id);
                } else if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED") {
                    await prisma.payment.update({ where: { id: payment.id }, data: { status } });
                }
            }
        } catch (e) {
            logger.warn("Billing", `Status polling check failed for payment ${payment.id}:`, e);
        }
    }

    const fresh: any = await prisma.payment.findUnique({ where: { id } });
    return NextResponse.json({
        status: true,
        data: {
            paymentId: fresh!.id,
            plan: fresh!.plan,
            amount: fresh!.amount,
            totalAmount: fresh!.totalAmount,
            provider: fresh!.provider,
            paymentStatus: fresh!.status,
            checkoutUrl: fresh!.checkoutUrl || (fresh!.rawResponse as any)?.checkoutUrl || null,
            paidAt: fresh!.paidAt,
            expiresAt: fresh!.expiresAt
        }
    });
}
