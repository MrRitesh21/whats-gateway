import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { executeSmartChat } from "@/lib/ai-gateway/gateway";

// ─── POST /api/ai-gateway/chat ────────────────────────────────────────────────
// Body:
//   question: string
//   customSystemPrompt?: string
//   specificAccountId?: string
//   useRAG?: boolean
//   chatHistory?: Array<{ role: "system" | "user" | "assistant"; content: string }>
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const {
            question,
            customSystemPrompt,
            specificAccountId,
            useRAG = true,
            chatHistory = [],
        } = body;

        if (!question || typeof question !== "string" || !question.trim()) {
            return NextResponse.json({ status: false, message: "Question cannot be empty" }, { status: 400 });
        }

        const result = await executeSmartChat({
            question: question.trim(),
            customSystemPrompt,
            specificAccountId,
            useRAG,
            chatHistory,
        });

        return NextResponse.json({
            status: true,
            data: result,
        });
    } catch (e: any) {
        console.error("AI Gateway Chat error", e);
        return NextResponse.json({
            status: false,
            message: e.message || "Failed to process AI chat request",
        }, { status: 500 });
    }
}
