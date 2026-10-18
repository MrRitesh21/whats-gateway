import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { markPaymentPaidAndActivate } from "@/lib/billing";
import { logger } from "@/lib/logger";

// POST /api/billing/utr
// Allows customer to submit their 12-digit UPI UTR (Bank Reference Number)
// for immediate plan activation.
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
        return NextResponse.json({ status: false, message: "Invalid JSON" }, { status: 400 });
    }

    const { paymentId, utr } = body;
    if (!paymentId || !utr) {
        return NextResponse.json(
            { status: false, message: "Please enter your 12-digit UPI UTR number" },
            { status: 400 }
        );
    }

    const cleanedUtr = String(utr).trim().replace(/\s+/g, "");
    if (cleanedUtr.length < 8 || cleanedUtr.length > 22) {
        return NextResponse.json(
            { status: false, message: "Please enter a valid UPI UTR / Transaction Reference number" },
            { status: 400 }
        );
    }

    const payment: any = await prisma.payment.findUnique({
        where: { id: String(paymentId) }
    });

    if (!payment || (payment.userId !== user.id && user.role !== "SUPERADMIN")) {
        return NextResponse.json(
            { status: false, message: "Payment transaction not found", error: "not_found" },
            { status: 404 }
        );
    }

    if (payment.status === "PAID") {
        return NextResponse.json({
            status: true,
            message: "This payment has already been verified and activated!"
        });
    }

    // Check if this UTR has already been claimed on another completed payment
    const existing: any = await prisma.payment.findFirst({
        where: {
            id: { not: payment.id },
            status: "PAID",
            signature: `UTR:${cleanedUtr}`
        }
    });

    if (existing) {
        return NextResponse.json(
            { status: false, message: "This UPI UTR reference has already been used for another subscription." },
            { status: 400 }
        );
    }

    try {
        // Record UTR on payment via native signature and rawResponse
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                signature: `UTR:${cleanedUtr}`,
                rawResponse: {
                    ...(payment.rawResponse && typeof payment.rawResponse === "object" ? payment.rawResponse : {}),
                    utr: cleanedUtr
                }
            }
        });

        // Activate user subscription plan
        await markPaymentPaidAndActivate(payment.id);
        logger.success("Billing", `Plan ${payment.plan} activated for user ${user.id} via UPI UTR: ${cleanedUtr}`);

        return NextResponse.json({
            status: true,
            message: "Payment verified successfully! Your plan has been upgraded 🎉"
        });
    } catch (e: any) {
        logger.error("Billing", "Failed to activate plan via UTR:", e);
        return NextResponse.json(
            { status: false, message: "Failed to verify transaction. Please contact support." },
            { status: 500 }
        );
    }
}
