import { NextRequest, NextResponse } from "next/server";
import { activateInstallationWithLab, validateSystemLicense } from "@/lib/license/integrity";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { purchaseCode, customerName, customerEmail, customerPhone } = body;

        if (!purchaseCode || !purchaseCode.trim()) {
            return NextResponse.json(
                { success: false, message: "Purchase code / license key is required." },
                { status: 400 }
            );
        }

        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";

        const session = await auth();
        const email = customerEmail || session?.user?.email || "";
        const name = customerName || session?.user?.name || "Administrator";

        const result = await activateInstallationWithLab({
            purchaseCode,
            currentHost: host,
            customerName: name,
            customerEmail: email,
            customerPhone
        });

        const response = NextResponse.json({
            success: true,
            message: "License successfully activated and verified with WebotApp Lab!",
            license: {
                purchaseCode: result.license.purchaseCode,
                licenseType: result.license.licenseType,
                licensedDomain: result.license.licensedDomain,
                activatedAt: result.license.activatedAt
            }
        });

        response.cookies.set("wa_sys_activated", "1", {
            path: "/",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 365
        });

        return response;
    } catch (err: any) {
        console.error("License activation failed:", err);
        return NextResponse.json(
            { success: false, message: err.message || "License activation failed." },
            { status: 422 }
        );
    }
}
