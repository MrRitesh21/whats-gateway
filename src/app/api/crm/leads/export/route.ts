import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getCRMData } from "@/lib/crm/storage";

function escapeCSV(val: any): string {
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// ─── GET /api/crm/leads/export ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const stage = searchParams.get("stage");

        const data = await getCRMData();
        let leads = data.leads;

        if (stage && stage !== "ALL") {
            leads = leads.filter((l) => l.stage === stage);
        }

        const headers = [
            "Name",
            "Phone",
            "Formatted Phone",
            "Category",
            "Second Category",
            "City",
            "State",
            "Address",
            "Website",
            "Rating",
            "Reviews Count",
            "Keyword",
            "Stage",
            "Tags",
            "Notes",
            "Status",
            "Created At",
        ];

        const rows: string[] = [headers.join(",")];

        for (const l of leads) {
            const row = [
                escapeCSV(l.name),
                escapeCSV(l.phone),
                escapeCSV(l.formattedPhone),
                escapeCSV(l.category),
                escapeCSV(l.secondCategory),
                escapeCSV(l.city),
                escapeCSV(l.state),
                escapeCSV(l.address),
                escapeCSV(l.website),
                escapeCSV(l.rating),
                escapeCSV(l.reviewsCount),
                escapeCSV(l.keyword),
                escapeCSV(l.stage),
                escapeCSV(l.tags?.join("; ")),
                escapeCSV(l.notes),
                escapeCSV(l.status),
                escapeCSV(l.createdAt),
            ];
            rows.push(row.join(","));
        }

        const csvString = rows.join("\n");

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="crm-leads-${Date.now()}.csv"`,
            },
        });
    } catch (e: any) {
        console.error("CRM Export error", e);
        return NextResponse.json({ status: false, message: "Export failed" }, { status: 500 });
    }
}
