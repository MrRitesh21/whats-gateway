import { NextRequest, NextResponse } from "next/server";
import { getSiteBySlug } from "@/lib/sites/storage";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await context.params;
        if (!slug) {
            return NextResponse.json({ status: false, message: "Slug is required" }, { status: 400 });
        }

        const site = await getSiteBySlug(slug);
        if (!site) {
            return NextResponse.json({ status: false, message: "Site not found" }, { status: 404 });
        }

        return NextResponse.json({ status: true, data: { site } });
    } catch (err: any) {
        console.error("Public site API error:", err);
        return NextResponse.json({ status: false, message: err.message || "Failed to load site" }, { status: 500 });
    }
}
