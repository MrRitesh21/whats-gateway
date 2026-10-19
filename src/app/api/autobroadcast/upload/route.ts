import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData().catch(() => null);
        if (!formData) {
            return NextResponse.json({ status: false, message: "Invalid multipart form data" }, { status: 400 });
        }

        const rawFile = formData.get("file") || formData.get("media") || formData.get("attachment");
        if (!rawFile || typeof rawFile === "string" || typeof (rawFile as any).arrayBuffer !== "function") {
            return NextResponse.json({ status: false, message: "No valid file uploaded" }, { status: 400 });
        }

        const file = rawFile as File;
        if (file.size === 0) {
            return NextResponse.json({ status: false, message: "Uploaded file is empty" }, { status: 400 });
        }

        // Support files up to 50MB
        const MAX = 50 * 1024 * 1024;
        if (file.size > MAX) {
            return NextResponse.json(
                { status: false, message: "File exceeds 50MB limit. Please attach a smaller file or use an external URL." },
                { status: 400 }
            );
        }

        const mime = (file.type || "").toLowerCase();
        const originalName = file.name || "attachment";
        const ext = path.extname(originalName).toLowerCase();

        // Categorize media type
        let type: "image" | "video" | "document" = "document";
        if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"].includes(ext)) {
            type = "image";
        } else if (mime.startsWith("video/") || [".mp4", ".mov", ".mkv", ".3gp", ".webm", ".avi"].includes(ext)) {
            type = "video";
        } else {
            type = "document";
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Save to data/media directory for fast local streaming without memory bloat
        const mediaDir = path.join(process.cwd(), "data", "media");
        await fs.mkdir(mediaDir, { recursive: true });

        const safeExt = ext || (type === "image" ? ".jpg" : type === "video" ? ".mp4" : ".bin");
        const cleanBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const savedFilename = `broadcast_${Date.now()}_${cleanBaseName}${safeExt}`;
        const filePath = path.join(mediaDir, savedFilename);

        await fs.writeFile(filePath, buffer);

        const mediaUrl = `/api/media/${encodeURIComponent(savedFilename)}`;

        // For small images (< 1MB), also provide dataUri so previews render instantly even if offline
        let dataUri: string | undefined;
        if (file.size <= 1024 * 1024 && type === "image") {
            const mimeType = mime || "image/jpeg";
            dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
        }

        return NextResponse.json({
            status: true,
            message: "File uploaded successfully",
            data: {
                url: dataUri || mediaUrl,
                fileUrl: mediaUrl,
                filename: originalName,
                type,
                size: file.size,
            }
        });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ status: false, message: error?.message || "Upload failed" }, { status: 400 });
    }
}

