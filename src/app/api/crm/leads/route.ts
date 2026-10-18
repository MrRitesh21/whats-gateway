import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
    getCRMData,
    saveLead,
    deleteLead,
    deleteLeads,
    batchUpdateStage,
    updateLeadStage,
    updateLeadPriority,
    batchUpdatePriority,
    updateLeadFollowUp,
    addLeadActivity,
} from "@/lib/crm/storage";
import { normalizePhoneNumber } from "@/lib/crm/csv-parser";
import type { Lead, LeadStage, LeadPriority } from "@/lib/crm/types";

// ─── GET: List leads with search, filters & pipeline metrics ──────────────────
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = (searchParams.get("search") || "").toLowerCase().trim();
        const stage = searchParams.get("stage") || "";
        const category = searchParams.get("category") || "";
        const city = searchParams.get("city") || "";
        const priority = searchParams.get("priority") || "";
        const followup = searchParams.get("followup") || "";
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limitParam = (searchParams.get("limit") || "5000").toLowerCase();
        const isAll = limitParam === "all";
        const limit = isAll ? 100000 : parseInt(limitParam, 10) || 5000;

        const data = await getCRMData();
        const todayStr = new Date().toISOString().split("T")[0];

        let filtered = data.leads;

        if (stage && stage !== "ALL") {
            filtered = filtered.filter((l) => l.stage === stage);
        }

        if (category && category !== "ALL") {
            filtered = filtered.filter((l) => l.category?.toLowerCase() === category.toLowerCase());
        }

        if (city && city !== "ALL") {
            filtered = filtered.filter((l) => l.city && l.city.toLowerCase() === city.toLowerCase());
        }

        if (priority && priority !== "ALL") {
            filtered = filtered.filter((l) => (l.priority || "WARM") === priority);
        }

        if (followup === "today") {
            filtered = filtered.filter((l) => l.followUpDate && l.followUpDate <= todayStr && l.stage !== "WON" && l.stage !== "LOST");
        }

        if (search) {
            filtered = filtered.filter((l) => {
                return (
                    l.name?.toLowerCase().includes(search) ||
                    l.phone?.includes(search) ||
                    l.formattedPhone?.includes(search) ||
                    (l.category && l.category.toLowerCase().includes(search)) ||
                    (l.city && l.city.toLowerCase().includes(search)) ||
                    (l.keyword && l.keyword.toLowerCase().includes(search)) ||
                    (l.address && l.address.toLowerCase().includes(search))
                );
            });
        }

        const total = filtered.length;
        const totalPages = isAll ? 1 : (Math.ceil(total / limit) || 1);
        const startIndex = isAll ? 0 : (page - 1) * limit;
        const paginatedLeads = isAll ? filtered : filtered.slice(startIndex, startIndex + limit);

        // Compute counts and values per stage
        const stageCounts: Record<string, number> = {
            ALL: data.leads.length,
            NEW: 0,
            CONTACTED: 0,
            INTERESTED: 0,
            QUALIFIED: 0,
            PROPOSAL: 0,
            WON: 0,
            LOST: 0,
        };

        const stageValues: Record<string, number> = {
            ALL: 0,
            NEW: 0,
            CONTACTED: 0,
            INTERESTED: 0,
            QUALIFIED: 0,
            PROPOSAL: 0,
            WON: 0,
            LOST: 0,
        };

        let followUpsTodayCount = 0;
        let totalPipelineValue = 0;
        let wonValue = 0;

        for (const l of data.leads) {
            const val = l.value || 0;
            totalPipelineValue += val;

            if (stageCounts[l.stage] !== undefined) {
                stageCounts[l.stage]++;
                stageValues[l.stage] = (stageValues[l.stage] || 0) + val;
            }

            if (l.stage === "WON") {
                wonValue += val;
            }

            if (l.followUpDate && l.followUpDate <= todayStr && l.stage !== "WON" && l.stage !== "LOST") {
                followUpsTodayCount++;
            }
        }
        stageValues.ALL = totalPipelineValue;

        // Distinct categories and cities for dropdown filters
        const categories = Array.from(new Set(data.leads.map((l) => l.category).filter(Boolean)));
        const cities = Array.from(new Set(data.leads.map((l) => l.city).filter(Boolean)));

        return NextResponse.json({
            status: true,
            data: {
                leads: paginatedLeads,
                meta: {
                    total,
                    page: isAll ? 1 : page,
                    limit: isAll ? total : limit,
                    totalPages,
                },
                stageCounts,
                stageValues,
                pipelineMetrics: {
                    totalLeads: data.leads.length,
                    totalPipelineValue,
                    wonValue,
                    followUpsTodayCount,
                },
                categories,
                cities,
            },
        });
    } catch (e: any) {
        console.error("CRM Leads GET error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to fetch leads" }, { status: 500 });
    }
}

// ─── POST: Create, update a lead, or add activity note ────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Sub-action: Add Activity / Note to lead timeline
        if (body.action === "add_activity") {
            const { leadId, activity } = body;
            if (!leadId || !activity?.content) {
                return NextResponse.json({ status: false, message: "leadId and activity content required" }, { status: 400 });
            }
            const updated = await addLeadActivity(leadId, {
                type: activity.type || "note",
                content: activity.content.trim(),
                author: user.email || "Agent",
            });
            return NextResponse.json({ status: true, message: "Activity logged", data: updated });
        }

        const { lead } = body;

        if (!lead || !lead.name?.trim() || !lead.phone?.trim()) {
            return NextResponse.json({ status: false, message: "Name and Phone are required" }, { status: 400 });
        }

        const { formatted, isValid } = normalizePhoneNumber(lead.phone, lead.country || "IN");
        if (!isValid || !formatted) {
            return NextResponse.json({ status: false, message: "Invalid phone number format" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const leadToSave: Lead = {
            id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: lead.name.trim(),
            phone: lead.phone.trim(),
            formattedPhone: formatted,
            whatsappJid: `${formatted}@s.whatsapp.net`,
            category: lead.category?.trim() || "General",
            secondCategory: lead.secondCategory?.trim() || undefined,
            city: lead.city?.trim() || undefined,
            state: lead.state?.trim() || undefined,
            address: lead.address?.trim() || undefined,
            zip: lead.zip?.trim() || undefined,
            country: lead.country?.trim() || "IN",
            website: lead.website?.trim() || undefined,
            rating: typeof lead.rating === "number" ? lead.rating : undefined,
            reviewsCount: typeof lead.reviewsCount === "number" ? lead.reviewsCount : undefined,
            keyword: lead.keyword?.trim() || undefined,
            stage: (lead.stage as LeadStage) || "NEW",
            priority: (lead.priority as LeadPriority) || "WARM",
            value: typeof lead.value === "number" ? lead.value : (parseFloat(lead.value) || undefined),
            currency: lead.currency || "₹",
            followUpDate: lead.followUpDate || undefined,
            followUpNote: lead.followUpNote?.trim() || undefined,
            tags: Array.isArray(lead.tags) ? lead.tags : [],
            notes: lead.notes?.trim() || undefined,
            activities: Array.isArray(lead.activities) ? lead.activities : undefined,
            source: lead.source?.trim() || "Manual",
            status: lead.status?.trim() || "open",
            lastContactedAt: lead.lastContactedAt || undefined,
            createdAt: lead.createdAt || now,
            updatedAt: now,
        };

        await saveLead(leadToSave);
        return NextResponse.json({ status: true, message: "Lead saved successfully", data: leadToSave });
    } catch (e: any) {
        console.error("CRM Leads POST error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to save lead" }, { status: 500 });
    }
}

// ─── PATCH: Batch update stage, priority, or follow-up ────────────────────────
export async function PATCH(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, ids, stage, priority, followUpDate, followUpNote, note } = body;

        // Stage updates
        if (stage) {
            if (Array.isArray(ids) && ids.length > 0) {
                const count = await batchUpdateStage(ids, stage as LeadStage);
                return NextResponse.json({ status: true, message: `Updated ${count} leads to ${stage}` });
            }
            if (id) {
                const updated = await updateLeadStage(id, stage as LeadStage, note);
                if (!updated) return NextResponse.json({ status: false, message: "Lead not found" }, { status: 404 });
                return NextResponse.json({ status: true, message: `Lead updated to ${stage}`, data: updated });
            }
        }

        // Priority updates
        if (priority) {
            if (Array.isArray(ids) && ids.length > 0) {
                const count = await batchUpdatePriority(ids, priority as LeadPriority);
                return NextResponse.json({ status: true, message: `Updated ${count} leads priority to ${priority}` });
            }
            if (id) {
                const updated = await updateLeadPriority(id, priority as LeadPriority);
                if (!updated) return NextResponse.json({ status: false, message: "Lead not found" }, { status: 404 });
                return NextResponse.json({ status: true, message: `Lead priority set to ${priority}`, data: updated });
            }
        }

        // Follow-up updates
        if (id && (followUpDate !== undefined || followUpNote !== undefined)) {
            const updated = await updateLeadFollowUp(id, followUpDate, followUpNote);
            if (!updated) return NextResponse.json({ status: false, message: "Lead not found" }, { status: 404 });
            return NextResponse.json({ status: true, message: "Follow-up updated", data: updated });
        }

        return NextResponse.json({ status: false, message: "Invalid update parameters" }, { status: 400 });
    } catch (e: any) {
        console.error("CRM Leads PATCH error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to update lead" }, { status: 500 });
    }
}

// ─── DELETE: Delete lead by ID or batch delete ────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const body = await request.json().catch(() => ({}));
        const ids = body.ids;

        if (Array.isArray(ids) && ids.length > 0) {
            const deleted = await deleteLeads(ids);
            return NextResponse.json({ status: true, message: `Deleted ${deleted} leads` });
        }

        if (id) {
            const ok = await deleteLead(id);
            if (!ok) return NextResponse.json({ status: false, message: "Lead not found" }, { status: 404 });
            return NextResponse.json({ status: true, message: "Lead deleted" });
        }

        return NextResponse.json({ status: false, message: "ID or IDs required" }, { status: 400 });
    } catch (e: any) {
        console.error("CRM Leads DELETE error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to delete lead" }, { status: 500 });
    }
}
