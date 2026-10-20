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

        // Authenticated user can view submissions for their forms
        let submissions: any[] = [];
        const user = await getAuthenticatedUser(req).catch(() => null);
        if (user) {
            // Check user's own store
            const userStore = await getFormsData(user.id);
            let formSubmissions = (userStore.submissions || []).filter((s) => s.formId === formId);

            // If not found in user's store and form has an owner, check owner's store (superadmin access)
            if (formSubmissions.length === 0 && form.userId && form.userId !== user.id && user.role === "SUPERADMIN") {
                const ownerStore = await getFormsData(form.userId);
                formSubmissions = (ownerStore.submissions || []).filter((s) => s.formId === formId);
            }

            // Fallback check in default store if still empty
            if (formSubmissions.length === 0) {
                const defStore = await getFormsData("default");
                formSubmissions = (defStore.submissions || []).filter((s) => s.formId === formId);
            }

            submissions = formSubmissions;
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
        const existing = await getFormById(formId, user.id);
        if (!existing) {
            return NextResponse.json({ status: false, message: "Form not found" }, { status: 404 });
        }

        const body = await req.json();
        const updated = await saveForm({
            ...existing,
            ...body,
            id: formId, // Immutable ID
            userId: existing.userId || user.id,
            updatedAt: new Date().toISOString(),
        }, user.id);

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
        const deleted = await deleteForm(formId, user.id);
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
