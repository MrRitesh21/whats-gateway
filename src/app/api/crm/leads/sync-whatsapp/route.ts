import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { syncContactsFromWhatsApp } from "@/lib/crm/storage";

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json({ status: false, message: "Session ID is required" }, { status: 400 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access session" }, { status: 403 });
        }

        const result = await syncContactsFromWhatsApp(sessionId);

        return NextResponse.json({
            status: true,
            message: `Successfully synced ${result.imported} contacts into CRM (${result.skippedDuplicates} duplicates skipped)`,
            data: result,
        });
    } catch (e: any) {
        console.error("Sync WhatsApp Contacts error:", e);
        return NextResponse.json({
            status: false,
            message: e.message || "Failed to sync contacts from WhatsApp",
        }, { status: 500 });
    }
}
