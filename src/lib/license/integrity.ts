import * as crypto from "crypto";
import { prisma } from "@/lib/prisma";

const CORE_INTEGRITY_SALT = process.env.LICENSE_INTEGRITY_SALT || "wb_wa_core_sec_89df7a2c8901e";
const LAB_API_BASE = process.env.LAB_API_BASE || "https://lab.webotapp.com/api";
const PRODUCT_SLUG = "whats-gateway-multi-device-api";
const PRODUCT_NAME = "WhatsGateway WhatsApp";

export interface LicenseValidationResult {
    valid: boolean;
    reason?: string;
    license?: {
        purchaseCode: string;
        licenseType: string;
        licenseeName: string | null;
        licenseeEmail: string | null;
        licensedDomain: string;
        activatedAt: Date;
    };
}

export function normalizeDomain(host: string | null | undefined): string {
    if (!host) return "localhost";
    return host
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .split(":")[0];
}

export function computeLicenseSignature(
    purchaseCode: string,
    licensedDomain: string,
    licenseType: string,
    activatedAt: Date
): string {
    const payload = [
        purchaseCode.trim().toUpperCase(),
        normalizeDomain(licensedDomain),
        licenseType.toLowerCase(),
        new Date(activatedAt).toISOString().split("T")[0],
        CORE_INTEGRITY_SALT
    ].join("::@@::");

    return crypto.createHmac("sha256", CORE_INTEGRITY_SALT).update(payload).digest("hex");
}

export function isDomainAuthorized(currentHost: string, licensedDomain: string): boolean {
    const curr = normalizeDomain(currentHost);
    const lic = normalizeDomain(licensedDomain);

    if (curr === lic) return true;
    if ((curr === "localhost" || curr === "127.0.0.1") && (lic === "localhost" || lic === "127.0.0.1")) {
        return true;
    }
    if (curr.endsWith("." + lic)) {
        return true;
    }
    return false;
}

export async function validateSystemLicense(currentHost?: string): Promise<LicenseValidationResult> {
    try {
        const record = await prisma.systemLicense.findUnique({
            where: { id: "singleton" }
        });

        if (!record || record.status !== "active") {
            return { valid: false, reason: "NOT_ACTIVATED" };
        }

        const expectedSignature = computeLicenseSignature(
            record.purchaseCode,
            record.licensedDomain,
            record.licenseType,
            record.activatedAt
        );

        if (record.signature !== expectedSignature) {
            console.error("[SECURITY ALERT] License record HMAC mismatch! Database tampering detected.");
            return { valid: false, reason: "TAMPER_DETECTED" };
        }

        if (currentHost && !isDomainAuthorized(currentHost, record.licensedDomain)) {
            return { 
                valid: false, 
                reason: `DOMAIN_MISMATCH: License is locked to '${record.licensedDomain}' but accessed from '${normalizeDomain(currentHost)}'` 
            };
        }

        return {
            valid: true,
            license: {
                purchaseCode: record.purchaseCode,
                licenseType: record.licenseType,
                licenseeName: record.licenseeName,
                licenseeEmail: record.licenseeEmail,
                licensedDomain: record.licensedDomain,
                activatedAt: record.activatedAt
            }
        };
    } catch (err: any) {
        console.error("License validation error:", err);
        return { valid: false, reason: "VERIFICATION_EXCEPTION: " + (err?.message || "Unknown error") };
    }
}

export async function activateInstallationWithLab(params: {
    purchaseCode: string;
    currentHost: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
}) {
    const cleanCode = params.purchaseCode.trim().toUpperCase();
    const domain = normalizeDomain(params.currentHost);

    let verifyResponse: any;
    try {
        const res = await fetch(`${LAB_API_BASE}/license/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                purchase_code: cleanCode,
                domain: domain,
                email: params.customerEmail || "",
                product_slug: PRODUCT_SLUG,
                app_name: PRODUCT_NAME
            })
        });
        verifyResponse = await res.json();
    } catch (netErr: any) {
        throw new Error("Unable to reach WebotApp Lab licensing server. Please check your internet connectivity.");
    }

    if (!verifyResponse || !verifyResponse.valid) {
        throw new Error(verifyResponse?.message || "Invalid license key or product mismatch.");
    }

    try {
        await fetch(`${LAB_API_BASE}/license/register-install`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                purchase_code: cleanCode,
                customer_name: params.customerName || "Authorized User",
                customer_email: params.customerEmail || verifyResponse.customer_email || "admin@local",
                customer_phone: params.customerPhone || "+91",
                installed_domain: domain,
                app_name: PRODUCT_NAME,
                app_version: "1.5.4",
                product_slug: PRODUCT_SLUG,
                agreed_license: true
            })
        });
    } catch (regErr) {
        // Non-blocking
    }

    const activatedAt = new Date();
    const licenseType = verifyResponse.license_type || (cleanCode.includes("-EXT-") ? "extended" : "regular");
    const signature = computeLicenseSignature(cleanCode, domain, licenseType, activatedAt);

    const saved = await prisma.systemLicense.upsert({
        where: { id: "singleton" },
        update: {
            purchaseCode: cleanCode,
            licenseType,
            licenseeName: params.customerName || verifyResponse.customer_name || null,
            licenseeEmail: params.customerEmail || verifyResponse.customer_email || null,
            licenseePhone: params.customerPhone || null,
            licensedDomain: domain,
            signature,
            status: "active",
            activatedAt,
            lastVerifiedAt: activatedAt
        },
        create: {
            id: "singleton",
            purchaseCode: cleanCode,
            licenseType,
            licenseeName: params.customerName || verifyResponse.customer_name || null,
            licenseeEmail: params.customerEmail || verifyResponse.customer_email || null,
            licenseePhone: params.customerPhone || null,
            licensedDomain: domain,
            signature,
            status: "active",
            activatedAt,
            lastVerifiedAt: activatedAt
        }
    });

    return {
        success: true,
        license: saved,
        product: verifyResponse.product || PRODUCT_NAME,
        licenseType
    };
}

export async function assertRuntimeExecutionSeal(): Promise<void> {
    const val = await validateSystemLicense();
    if (!val.valid) {
        const errMsg = `[FATAL LICENSE LOCK] WhatsApp Gateway engine execution halted: ${val.reason || "Unauthorized"}. Activation required at /activate`;
        console.error(errMsg);
        throw new Error(errMsg);
    }
}
