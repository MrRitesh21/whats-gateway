import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { generateAndSaveSite } from "@/lib/sites/storage";
import type { GenerateSiteInput } from "@/lib/sites/types";

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { leadId, businessName, category, city, address, phone, themeColor, headline, tagline, customServices } = body;

        if (!businessName || !businessName.trim()) {
            return NextResponse.json({ status: false, message: "Business name is required" }, { status: 400 });
        }
        if (!phone || !phone.trim()) {
            return NextResponse.json({ status: false, message: "WhatsApp phone number is required" }, { status: 400 });
        }

        const input: GenerateSiteInput = {
            leadId,
            businessName: businessName.trim(),
            category: category?.trim(),
            city: city?.trim(),
            address: address?.trim(),
            phone: phone.trim(),
            themeColor,
            headline: headline?.trim(),
            tagline: tagline?.trim(),
            customServices: Array.isArray(customServices) ? customServices : undefined,
        };

        const { site, leadUpdated } = await generateAndSaveSite(input, user.id);

        // Compute full public URL using the incoming request host
        const proto = request.headers.get("x-forwarded-proto") || "http";
        const host = request.headers.get("host") || "localhost:3030";
        const publicUrl = `${proto}://${host}/site/${site.slug}`;

        // Polite, high-converting WhatsApp message ready to be sent to the client
        const whatsappShareText = `Namaste *${site.businessName}*,\n\nHumne aapke business ke liye ek complete, modern aur mobile-friendly website taiyar ki hai:\n🌐 ${publicUrl}\n\nIse apne smartphone me open karke check karein aur batayein kaisa laga!\n\n_Powered by Enterprise Gateway_`;

        return NextResponse.json({
            status: true,
            message: "Website generated and linked successfully",
            data: {
                site,
                publicUrl,
                whatsappShareText,
                leadUpdated,
            },
        });
    } catch (err: any) {
        console.error("Generate site API error:", err);
        return NextResponse.json({ status: false, message: err.message || "Failed to generate website" }, { status: 500 });
    }
}
