import { NextResponse } from "next/server";
import { isSystemLicensed, getLicenseInfo } from "@/lib/license";
import fs from "fs";
import path from "path";

export async function GET() {
  const isLicensed = isSystemLicensed();
  const license = getLicenseInfo();
  
  // Check if .env exists
  const envExists = fs.existsSync(path.join(process.cwd(), '.env'));

  return NextResponse.json({
    installed: isLicensed && envExists,
    isLicensed,
    license,
    nodeVersion: process.version,
    platform: process.platform,
    envExists
  });
}
