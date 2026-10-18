import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { databaseUrl, adminName, adminEmail, adminPassword, appName } = await req.json();

    if (!databaseUrl || !adminEmail || !adminPassword) {
      return NextResponse.json({ success: false, message: "Missing required setup fields." }, { status: 400 });
    }

    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else if (fs.existsSync(path.join(process.cwd(), '.env.example'))) {
      envContent = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
    }

    const authSecret = crypto.randomBytes(32).toString('hex');
    const finalAppName = appName || 'WebotApp WhatsGateway';

    // Update or append DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=".*"/g, `DATABASE_URL="${databaseUrl}"`);
      envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${databaseUrl}"`);
    } else {
      envContent += `\nDATABASE_URL="${databaseUrl}"\n`;
    }

    // Update AUTH_SECRET
    if (envContent.includes('AUTH_SECRET=')) {
      envContent = envContent.replace(/AUTH_SECRET=".*"/g, `AUTH_SECRET="${authSecret}"`);
    } else {
      envContent += `\nAUTH_SECRET="${authSecret}"\n`;
    }

    // Update APP_NAME
    if (envContent.includes('APP_NAME=')) {
      envContent = envContent.replace(/APP_NAME=".*"/g, `APP_NAME="${finalAppName}"`);
    } else {
      envContent += `\nAPP_NAME="${finalAppName}"\n`;
    }

    fs.writeFileSync(envPath, envContent);

    // Initialize Prisma and create Superadmin
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } }
    });

    try {
      await prisma.$connect();
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const apiKey = 'wg_' + crypto.randomBytes(24).toString('hex');

      await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
          name: adminName || 'Admin',
          password: hashedPassword,
          role: 'SUPERADMIN',
          apiKey: apiKey
        },
        create: {
          name: adminName || 'Admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'SUPERADMIN',
          apiKey: apiKey
        }
      });
      await prisma.$disconnect();
    } catch (dbErr: any) {
      console.warn('[Install] Notice during user creation:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "Installation completed successfully! You can now log into your dashboard."
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Setup failed" }, { status: 500 });
  }
}
