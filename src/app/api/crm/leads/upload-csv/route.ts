import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { importLeads } from "@/lib/crm/storage";

// ─── POST /api/crm/leads/upload-csv ───────────────────────────────────────────
// Accepts:
//   - multipart/form-data with `file`
//   - application/json with `{ csvText }`
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        let csvContent = "";
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            if (!file) {
                return NextResponse.json({ status: false, message: "No CSV file uploaded" }, { status: 400 });
            }
            csvContent = await file.text();
        } else {
            const body = await request.json().catch(() => ({}));
            csvContent = body.csvText || "";
        }

        if (!csvContent || !csvContent.trim()) {
            return NextResponse.json({ status: false, message: "CSV content cannot be empty" }, { status: 400 });
        }

        const result = await importLeads(csvContent);

        return NextResponse.json({
            status: true,
            message: `Successfully imported ${result.imported} leads (${result.skippedDuplicates} duplicates skipped, ${result.invalidPhone} invalid numbers)`,
            data: {
                totalRows: result.totalRows,
                imported: result.imported,
                skippedDuplicates: result.skippedDuplicates,
                invalidPhone: result.invalidPhone,
                sampleLeads: result.leads.slice(0, 5),
            },
        });
    } catch (e: any) {
        console.error("CSV Upload error", e);
        return NextResponse.json({
            status: false,
            message: e.message || "Failed to process and import CSV",
        }, { status: 500 });
    }
}
