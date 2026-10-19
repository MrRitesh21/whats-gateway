import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getFormById, saveForm, deleteForm, getFormsData } from "@/lib/forms/storage";

// GET /api/forms/[formId] — Retrieve form details and submissions
export async function GET(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
    try {
        const { formId } = await params;
        const form = await getFormById(formId);
        if (!form) {
            return NextResponse.json({ status: false, message: "Form not found" }, { status: 404 });
        }

        // Check auth to decide if submissions should be returned
        const user = await getAuthenticatedUser(req);
        let submissions: any[] = [];
        if (user) {
            const allData = await getFormsData();
            submissions = allData.submissions.filter((s) => s.formId === formId);
        }

        return NextResponse.json({
            status: true,
            data: {
                form,
                submissions,
            },
        });
    } catch (err: any) {
        return NextResponse.json({
            status: false,
            message: err.message || "Failed to retrieve form",
        }, { status: 500 });
    }
}

// PUT /api/forms/[formId] — Update an existing form
export async function PUT(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { formId } = await params;
        const existing = await getFormById(formId);
        if (!existing) {
            return NextResponse.json({ status: false, message: "Form not found" }, { status: 404 });
        }

        const body = await req.json();
        const updated = await saveForm({
            ...existing,
            ...body,
            id: formId, // Immutable ID
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            status: true,
            message: "Form updated successfully",
            data: updated,
        });
    } catch (err: any) {
        return NextResponse.json({
            status: false,
            message: err.message || "Failed to update form",
        }, { status: 500 });
    }
}

// DELETE /api/forms/[formId] — Delete a form
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { formId } = await params;
        const deleted = await deleteForm(formId);
        if (!deleted) {
            return NextResponse.json({ status: false, message: "Form not found" }, { status: 404 });
        }

        return NextResponse.json({
            status: true,
            message: "Form deleted successfully",
        });
    } catch (err: any) {
        return NextResponse.json({
            status: false,
            message: err.message || "Failed to delete form",
        }, { status: 500 });
    }
}
