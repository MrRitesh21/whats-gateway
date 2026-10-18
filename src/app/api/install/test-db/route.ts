import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { databaseUrl } = await req.json();
    if (!databaseUrl) {
      return NextResponse.json({ success: false, message: "Database URL is required." }, { status: 400 });
    }

    const testPrisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } }
    });

    await testPrisma.$connect();
    await testPrisma.$disconnect();

    return NextResponse.json({ success: true, message: "Database connection successful!" });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || "Failed to connect to database. Check credentials and host."
    }, { status: 400 });
  }
}
