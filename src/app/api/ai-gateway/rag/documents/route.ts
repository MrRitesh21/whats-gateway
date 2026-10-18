import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { getAIGatewayData, saveDocument, deleteDocument } from "@/lib/ai-gateway/storage";
import { chunkDocument } from "@/lib/ai-gateway/rag";
import type { KnowledgeDocument } from "@/lib/ai-gateway/types";

// ─── GET: List all knowledge documents with chunk metrics ─────────────────────
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const data = await getAIGatewayData();
        const docsWithStats = data.documents.map((doc) => {
            const chunks = chunkDocument(doc, data.ragConfig.chunkSize, data.ragConfig.chunkOverlap);
            return {
                ...doc,
                chunkCount: chunks.length,
                charCount: doc.content.length,
            };
        });

        return NextResponse.json({ status: true, data: docsWithStats });
    } catch (e: any) {
        console.error("RAG Documents GET error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to list documents" }, { status: 500 });
    }
}

// ─── POST: Create or update a knowledge document ───────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, title, category = "General", content, tags = [], isActive = true } = body;

        if (!title || !title.trim()) {
            return NextResponse.json({ status: false, message: "Document title is required" }, { status: 400 });
        }
        if (!content || !content.trim()) {
            return NextResponse.json({ status: false, message: "Document content cannot be empty" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const docToSave: KnowledgeDocument = {
            id: id || `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            title: title.trim(),
            category: category.trim(),
            content: content.trim(),
            tags: Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
            isActive: isActive !== false,
            createdAt: now,
            updatedAt: now,
        };

        await saveDocument(docToSave);

        const data = await getAIGatewayData();
        const chunks = chunkDocument(docToSave, data.ragConfig.chunkSize, data.ragConfig.chunkOverlap);

        return NextResponse.json({
            status: true,
            message: "Document saved and indexed successfully",
            data: {
                ...docToSave,
                chunkCount: chunks.length,
                charCount: docToSave.content.length,
            },
        });
    } catch (e: any) {
        console.error("RAG Documents POST error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to save document" }, { status: 500 });
    }
}

// ─── DELETE: Delete a knowledge document ───────────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ status: false, message: "Document ID is required" }, { status: 400 });
        }

        const ok = await deleteDocument(id);
        if (!ok) {
            return NextResponse.json({ status: false, message: "Document not found" }, { status: 404 });
        }

        return NextResponse.json({ status: true, message: "Document deleted successfully" });
    } catch (e: any) {
        console.error("RAG Documents DELETE error", e);
        return NextResponse.json({ status: false, message: e.message || "Failed to delete document" }, { status: 500 });
    }
}
