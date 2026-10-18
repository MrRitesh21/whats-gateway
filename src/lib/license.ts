import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LICENSE_FILE = path.join(process.cwd(), '.license.json');

export interface LicenseData {
  purchase_code: string;
  license_type: 'regular' | 'extended';
  customer_name: string;
  customer_email: string;
  domain: string;
  activated_at: string;
  token?: string;
  updates_until?: string | null;
  support_until?: string | null;
}

export function detectLicenseType(code: string): 'regular' | 'extended' {
  if (!code) return 'regular';
  const clean = String(code).trim().toUpperCase();
  if (clean.includes('-EXT-') || clean.startsWith('EXT-') || clean.endsWith('-EXT')) {
    return 'extended';
  }
  return 'regular';
}

export function getLicenseInfo(): LicenseData | null {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      const data = fs.readFileSync(LICENSE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.purchase_code) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[License] Failed to read license file:', err);
  }
  return null;
}

export function isSystemLicensed(): boolean {
  if (process.env.SKIP_LICENSE_CHECK === 'true') {
    return true;
  }
  const license = getLicenseInfo();
  return !!license && !!license.purchase_code;
}

export async function verifyAndSaveLicense(params: {
  purchase_code: string;
  customer_name: string;
  customer_email: string;
  domain: string;
}): Promise<{ success: boolean; message: string; data?: LicenseData }> {
  const { purchase_code, customer_name, customer_email, domain } = params;

  if (!purchase_code || !purchase_code.trim()) {
    return { success: false, message: 'Purchase code is required.' };
  }

  const cleanCode = purchase_code.trim().toUpperCase();
  const labUrl = process.env.WEBOTAPP_LAB_URL || 'https://lab.webotapp.com';

  try {
    // 1. Verify code with WebotApp Lab Central API
    const verifyRes = await fetch(`${labUrl}/api/verify-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchase_code: cleanCode,
        domain: domain || 'localhost',
        email: customer_email || 'client@webotapp.com'
      })
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.valid) {
      return {
        success: false,
        message: verifyData.message || 'Invalid purchase code. Please obtain a valid license from your WebotApp Lab dashboard.'
      };
    }

    const licenseType = detectLicenseType(cleanCode);

    // 2. Record installation at WebotApp Lab
    try {
      await fetch(`${labUrl}/api/installations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_code: cleanCode,
          domain: domain || 'localhost',
          customer_name: customer_name || 'Admin',
          customer_email: customer_email || 'client@webotapp.com',
          customer_phone: '',
          version: '1.0.0',
          installation_type: 'production'
        })
      });
    } catch (installErr) {
      console.warn('[License] Warning: Failed to record installation remotely:', installErr);
    }

    // 3. Save license locally
    const licensePayload: LicenseData = {
      purchase_code: cleanCode,
      license_type: licenseType,
      customer_name: customer_name || 'Admin',
      customer_email: customer_email || '',
      domain: domain || 'localhost',
      activated_at: new Date().toISOString(),
      token: crypto.randomBytes(16).toString('hex'),
      updates_until: verifyData.license?.updates_until || (licenseType === 'extended' ? 'Lifetime' : new Date(Date.now() + 365*24*60*60*1000).toISOString()),
      support_until: verifyData.license?.support_until || (licenseType === 'extended' ? 'Lifetime' : new Date(Date.now() + 365*24*60*60*1000).toISOString())
    };

    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licensePayload, null, 2));

    return {
      success: true,
      message: `License activated successfully (${licenseType === 'extended' ? 'Lifetime Extended' : '1-Year Regular'} License)!`,
      data: licensePayload
    };
  } catch (err: any) {
    console.error('[License] Error validating license with WebotApp Lab:', err);
    return {
      success: false,
      message: 'Could not connect to WebotApp Lab license verification server. Please check your internet connection.'
    };
  }
}
