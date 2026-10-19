import { NextRequest, NextResponse } from "next/server";
import { getFormById } from "@/lib/forms/storage";
import { handleFormSubmission } from "@/lib/forms/outreach";

// CORS Headers so client websites can embed the form via JavaScript fetch/AJAX
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
    try {
        const { formId } = await params;
        const form = await getFormById(formId);

        if (!form) {
            return NextResponse.json(
                { status: false, message: "Form not found or has been removed" },
                { status: 404, headers: CORS_HEADERS }
            );
        }

        if (!form.isActive) {
            return NextResponse.json(
                { status: false, message: "This form is currently closed for new submissions" },
                { status: 403, headers: CORS_HEADERS }
            );
        }

        // Extract submission data
        let submissionData: Record<string, string> = {};
        const contentType = req.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            submissionData = await req.json().catch(() => ({}));
        } else if (
            contentType.includes("multipart/form-data") ||
            contentType.includes("application/x-www-form-urlencoded")
        ) {
            const formData = await req.formData().catch(() => null);
            if (formData) {
                formData.forEach((val, key) => {
                    if (typeof val === "string") {
                        submissionData[key] = val;
                    }
                });
            }
        } else {
            // Fallback try reading json
            submissionData = await req.json().catch(() => ({}));
        }

        // Validate required fields configured in form
        for (const field of form.fields) {
            if (field.required && !submissionData[field.id]?.trim()) {
                return NextResponse.json(
                    {
                        status: false,
                        message: `Field "${field.label}" is required.`,
                        missingField: field.id,
                    },
                    { status: 400, headers: CORS_HEADERS }
                );
            }
        }

        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
        const userAgent = req.headers.get("user-agent") || undefined;

        const result = await handleFormSubmission({
            form,
            submissionData,
            ip,
            userAgent,
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    status: false,
                    message: result.message,
                },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // If this was a standard browser POST with redirectUrl configured
        const acceptHeader = req.headers.get("accept") || "";
        const isStandardFormPost = !contentType.includes("application/json") && acceptHeader.includes("text/html");
        if (isStandardFormPost && form.redirectUrl) {
            return NextResponse.redirect(form.redirectUrl, 303);
        }

        return NextResponse.json(
            {
                status: true,
                message: result.message,
                leadId: result.leadId,
                outreachSent: result.outreachSent,
                outreachMessage: result.outreachMessage,
                redirectUrl: form.redirectUrl || undefined,
            },
            { status: 200, headers: CORS_HEADERS }
        );
    } catch (err: any) {
        return NextResponse.json(
            {
                status: false,
                message: err.message || "An unexpected error occurred processing your submission.",
            },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
