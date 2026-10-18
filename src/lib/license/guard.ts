import { NextResponse } from "next/server";
import { validateSystemLicense } from "./integrity";

export async function checkApiLicense(req?: Request) {
    let host = "";
    if (req) {
        host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    }
    const result = await validateSystemLicense(host);
    if (!result.valid) {
        return {
            authorized: false,
            response: NextResponse.json(
                {
                    error: "LICENSE_REQUIRED",
                    message: "Software license activation required. Please visit /activate to complete setup.",
                    reason: result.reason
                },
                { status: 403 }
            )
        };
    }
    return { authorized: true, license: result.license };
}
