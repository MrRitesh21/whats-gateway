import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";

export const runtime = "nodejs";

// Upload media auto-broadcast → dikembalikan sebagai DATA URI (base64), bukan file.
// Disimpan di DB (kolom mediaUrl) supaya TIDAK hilang saat container restart
// (filesystem ephemeral, mis. Railway tanpa volume). Saat broadcast dikirim,
// data URI di-decode kembali jadi buffer.
export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });

    try {
        const formData = await request.formData().catch(() => null);
        if (!formData) {
            return NextResponse.json({ status: false, message: "Invalid multipart form data" }, { status: 400 });
        }

        const rawFile = formData.get("file");
        if (!rawFile || typeof rawFile === "string" || typeof (rawFile as any).arrayBuffer !== "function") {
            return NextResponse.json({ status: false, message: "No valid file uploaded" }, { status: 400 });
        }

        const file = rawFile as File;
        const mime = (file.type || "").toLowerCase();
        const ext = file.name ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase() : "";

        // Determine general media category
        let type: "image" | "video" | "document" = "document";
        if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
            type = "image";
        } else if (mime.startsWith("video/") || [".mp4", ".mov", ".mkv", ".3gp", ".webm"].includes(ext)) {
            type = "video";
        } else {
            type = "document";
        }

        // Limit size: 16MB
        const MAX = 16 * 1024 * 1024;
        if (file.size > MAX) {
            return NextResponse.json(
                { status: false, message: "File exceeds 16MB limit. Please attach a smaller file or use an external URL." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = mime || (type === "image" ? "image/jpeg" : type === "video" ? "video/mp4" : "application/octet-stream");
        const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

        return NextResponse.json({
            status: true,
            message: "File uploaded successfully",
            data: { url: dataUri, filename: file.name, type }
        });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ status: false, message: error?.message || "Upload failed" }, { status: 400 });
    }
}
