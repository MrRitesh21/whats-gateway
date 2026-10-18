import { NextRequest, NextResponse } from "next/server";
import { validateSystemLicense } from "@/lib/license/integrity";

export async function GET(req: NextRequest) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
    const status = await validateSystemLicense(host);

    if (!status.valid) {
        return NextResponse.json({
            active: false,
            reason: status.reason,
            currentHost: host
        });
    }

    const maskedCode = status.license?.purchaseCode 
        ? status.license.purchaseCode.substring(0, 8) + "-****-****-" + status.license.purchaseCode.slice(-4)
        : "";

    return NextResponse.json({
        active: true,
        licenseType: status.license?.licenseType,
        licensedDomain: status.license?.licensedDomain,
        licenseeName: status.license?.licenseeName,
        activatedAt: status.license?.activatedAt,
        maskedCode,
        currentHost: host
    });
}
