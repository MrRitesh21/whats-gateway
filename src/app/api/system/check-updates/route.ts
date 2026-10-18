import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getLicenseInfo } from "@/lib/license";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    const license = getLicenseInfo();
    const labUrl = process.env.WEBOTAPP_LAB_URL || 'https://lab.webotapp.com';

    try {
        const response = await fetch(`${labUrl}/api/check-updates?current_version=1.0.0&purchase_code=${encodeURIComponent(license?.purchase_code || '')}`);
        if (!response.ok) {
            return NextResponse.json({ status: true, message: "System is up to date.", data: { version: "1.0.0" } });
        }

        const data = await response.json();
        const hasUpdate = data.has_update;
        const version = data.latest_version || "1.0.0";
        const title = `New Update Available: v${version}`;

        if (!hasUpdate) {
            return NextResponse.json({ status: true, message: "Already running the latest version.", data: { version } });
        }

        const existing = await prisma.notification.findFirst({
            where: {
                userId: user.id,
                title: title
            }
        });

        if (existing) {
            return NextResponse.json({ status: true, message: "Update notification already received", data: { version } });
        }

        const notification = await prisma.notification.create({
            data: {
                userId: user.id,
                title: title,
                message: `A new version (v${version}) of WebotApp WhatsGateway is available from WebotApp Lab!\n\n${data.changelog || 'Performance improvements and security updates.'}`,
                type: "SYSTEM",
                href: "https://lab.webotapp.com/dashboard"
            }
        });

        const io = (global as any).io;
        if (io) {
            io.to(`user:${user.id}`).emit('notification:new', {
                id: notification.id,
                userId: user.id,
                title,
                message: notification.message,
                createdAt: notification.createdAt
            });
        }

        return NextResponse.json({
            status: true,
            message: "Update check completed",
            data: {
                currentVersion: "1.0.0",
                latestVersion: version,
                hasUpdate: true
            }
        });
    } catch (error: any) {
        console.error("Check updates error:", error);
        return NextResponse.json({ status: false, message: "Error checking for updates", error: error.message }, { status: 500 });
    }
}
