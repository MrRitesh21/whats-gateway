import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const CORE_INTEGRITY_SALT = process.env.LICENSE_INTEGRITY_SALT || 'wb_wa_core_sec_89df7a2c8901e';
const PURCHASE_CODE = 'WEBOT-REG-B146-CDE0-562B';
const DOMAIN = 'localhost';
const LICENSE_TYPE = 'regular';
const activatedAt = new Date();

function normalizeDomain(host: string | null | undefined): string {
    if (!host) return 'localhost';
    return host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
}

function computeLicenseSignature(purchaseCode: string, licensedDomain: string, licenseType: string, date: Date | string): string {
    const payload = [
        purchaseCode.trim().toUpperCase(),
        normalizeDomain(licensedDomain),
        licenseType.toLowerCase(),
        new Date(date).toISOString().split('T')[0],
        CORE_INTEGRITY_SALT
    ].join('::@@::');
    return crypto.createHmac('sha256', CORE_INTEGRITY_SALT).update(payload).digest('hex');
}

async function main() {
    const prisma = new PrismaClient();
    const signature = computeLicenseSignature(PURCHASE_CODE, DOMAIN, LICENSE_TYPE, activatedAt);

    console.log('⚡ Upserting SystemLicense into database...');
    const record = await prisma.systemLicense.upsert({
        where: { id: 'singleton' },
        update: {
            purchaseCode: PURCHASE_CODE,
            licenseType: LICENSE_TYPE,
            licenseeName: 'Ritesh',
            licenseeEmail: 'admin@example.com',
            licenseePhone: '+917002484119',
            licensedDomain: DOMAIN,
            signature,
            status: 'active',
            activatedAt,
            lastVerifiedAt: activatedAt
        },
        create: {
            id: 'singleton',
            purchaseCode: PURCHASE_CODE,
            licenseType: LICENSE_TYPE,
            licenseeName: 'Ritesh',
            licenseeEmail: 'admin@example.com',
            licenseePhone: '+917002484119',
            licensedDomain: DOMAIN,
            signature,
            status: 'active',
            activatedAt,
            lastVerifiedAt: activatedAt
        }
    });
    console.log('✅ SystemLicense active in DB:', record.purchaseCode);

    const licensePayload = {
        purchase_code: PURCHASE_CODE,
        license_type: LICENSE_TYPE,
        customer_name: 'Ritesh',
        customer_email: 'admin@example.com',
        domain: DOMAIN,
        activated_at: activatedAt.toISOString(),
        token: crypto.randomBytes(16).toString('hex'),
        updates_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        support_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };
    const licenseFile = path.join(process.cwd(), '.license.json');
    fs.writeFileSync(licenseFile, JSON.stringify(licensePayload, null, 2), 'utf8');
    console.log('✅ .license.json created successfully!');

    await prisma.$disconnect();
}

main().catch(console.error);
