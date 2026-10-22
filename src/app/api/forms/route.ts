import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getFormsData, saveForm } from "@/lib/forms/storage";
import type { LeadForm } from "@/lib/forms/types";
import { prisma } from "@/lib/prisma";

// GET /api/forms — List all lead capture forms
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const data = await getFormsData(user.id);

        // Fetch available connected sessions so UI can populate dropdown
        const sessionFilter = user.role === "SUPERADMIN" ? {} : { userId: user.id };
        const sessions = await prisma.session.findMany({
            where: sessionFilter,
            select: {
                id: true,
                sessionId: true,
                name: true,
                status: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            status: true,
            data: {
                forms: data.forms,
                totalSubmissions: data.submissions.length,
                submissions: data.submissions,
                sessions,
            },
        });
    } catch (err: any) {
        return NextResponse.json({
            status: false,
            message: err.message || "Failed to fetch forms",
        }, { status: 500 });
    }
}

// POST /api/forms — Create or update a lead capture form
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        if (!body.title || typeof body.title !== "string") {
            return NextResponse.json({ status: false, message: "Form title is required" }, { status: 400 });
        }

        const id = body.id?.trim() || `form-${body.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

        const form: LeadForm = {
            id,
            userId: user.id,
            title: body.title.trim(),
            description: body.description || "",
            fields: Array.isArray(body.fields) && body.fields.length > 0 ? body.fields : [
                { id: "name", label: "Full Name", type: "text", placeholder: "Your Name", required: true },
                { id: "phone", label: "WhatsApp Number", type: "tel", placeholder: "+91 9876543210", required: true },
                { id: "email", label: "Email Address", type: "email", placeholder: "name@example.com", required: false },
                { id: "message", label: "Message", type: "textarea", placeholder: "How can we help you?", required: false },
            ],
            submitButtonText: body.submitButtonText || "Submit Inquiry",
            successMessage: body.successMessage || "Thank you! We will reach out to you on WhatsApp shortly.",
            redirectUrl: body.redirectUrl || "",
            sessionId: body.sessionId || "",
            leadStage: body.leadStage || "NEW",
            leadCategory: body.leadCategory || "Website Inbound",
            leadTags: Array.isArray(body.leadTags) ? body.leadTags : ["website", "lead-form"],
            enableAiOutreach: Boolean(body.enableAiOutreach),
            enableLeadAlerts: body.enableLeadAlerts !== false,
            outreachMode: body.outreachMode === "template" ? "template" : "ai_personalized",
            aiPrompt: body.aiPrompt || "",
            templateMessage: body.templateMessage || "",
            theme: body.theme || "emerald",
            customCss: body.customCss || "",
            brandColor: body.brandColor || "#10B981",
            backgroundColor: body.backgroundColor || "#ffffff",
            textColor: body.textColor || "#0f172a",
            borderRadius: typeof body.borderRadius === "number" ? body.borderRadius : 12,
            viewsCount: typeof body.viewsCount === "number" ? body.viewsCount : 0,
            submissionsCount: typeof body.submissionsCount === "number" ? body.submissionsCount : 0,
            outreachSentCount: typeof body.outreachSentCount === "number" ? body.outreachSentCount : 0,
            isActive: body.isActive !== false,
            createdAt: body.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const saved = await saveForm(form, user.id);
        return NextResponse.json({
            status: true,
            message: "Form saved successfully",
            data: saved,
        });
    } catch (err: any) {
        return NextResponse.json({
            status: false,
            message: err.message || "Failed to save form",
        }, { status: 500 });
    }
}
