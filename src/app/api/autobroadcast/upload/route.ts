import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";

export const runtime = "nodejs";

// Asynchronous cleanup for temporary broadcast media older than 24h
async function cleanupOldMedia(mediaDir: string) {
    try {
        const files = await fs.readdir(mediaDir);
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000;
        for (const file of files) {
            if (file.startsWith("broadcast_")) {
                const fp = path.join(mediaDir, file);
                const stat = await fs.stat(fp).catch(() => null);
                if (stat && now - stat.mtimeMs > MAX_AGE) {
                    await fs.unlink(fp).catch(() => {});
                }
            }
        }
    } catch {
        // Ignore cleanup errors
    }
}

export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const contentType = (request.headers.get("content-type") || "").toLowerCase();
        let originalName = "attachment";
        let mime = "";
        let finalSize = 0;

        const mediaDir = path.join(process.cwd(), "data", "media");
        await fs.mkdir(mediaDir, { recursive: true });

        // Support files up to 50MB (WhatsApp supports up to 16MB for video or up to 100MB for document)
        const MAX = 50 * 1024 * 1024;

        let savedFilename = "";
        let type: "image" | "video" | "document" = "document";

        if (contentType.includes("application/json")) {
            const body = await request.json().catch(() => ({}));
            const raw = body.file || body.data || body.dataUri || body.base64;
            if (!raw || typeof raw !== "string") {
                return NextResponse.json({ status: false, message: "No valid file data in JSON payload" }, { status: 400 });
            }

            originalName = body.filename || body.name || "attachment";
            let buffer: Buffer;
            if (raw.startsWith("data:")) {
                const match = raw.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    mime = match[1];
                    buffer = Buffer.from(match[2], "base64");
                } else {
                    const commaIdx = raw.indexOf(",");
                    buffer = Buffer.from(commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw, "base64");
                }
            } else {
                buffer = Buffer.from(raw, "base64");
            }

            if (!buffer || buffer.length === 0) {
                return NextResponse.json({ status: false, message: "Uploaded file is empty" }, { status: 400 });
            }

            if (buffer.length > MAX) {
                return NextResponse.json(
                    { status: false, message: "File exceeds 50MB limit. Please attach a smaller file or use an external URL." },
                    { status: 400 }
                );
            }

            finalSize = buffer.length;
            const ext = path.extname(originalName).toLowerCase();
            if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"].includes(ext)) {
                type = "image";
            } else if (mime.startsWith("video/") || [".mp4", ".mov", ".mkv", ".3gp", ".webm", ".avi"].includes(ext)) {
                type = "video";
            } else {
                type = "document";
            }

            const safeExt = ext || (type === "image" ? ".jpg" : type === "video" ? ".mp4" : ".bin");
            const cleanBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "file";
            savedFilename = `broadcast_${Date.now()}_${cleanBaseName}${safeExt}`;
            const filePath = path.join(mediaDir, savedFilename);

            await fs.writeFile(filePath, buffer);
        } else {
            const formData = await request.formData().catch((err) => {
                console.error("formData parsing error:", err);
                return null;
            });
            if (!formData) {
                return NextResponse.json({ status: false, message: "Invalid form data or request payload. File may be too large." }, { status: 400 });
            }

            const rawFile = formData.get("file") || formData.get("media") || formData.get("attachment");
            if (!rawFile || typeof rawFile === "string" || typeof (rawFile as any).arrayBuffer !== "function") {
                return NextResponse.json({ status: false, message: "No valid file attached to upload" }, { status: 400 });
            }

            const file = rawFile as File;
            if (file.size === 0) {
                return NextResponse.json({ status: false, message: "Uploaded file is empty" }, { status: 400 });
            }

            if (file.size > MAX) {
                return NextResponse.json(
                    { status: false, message: "File exceeds 50MB limit. Please attach a smaller file or use an external URL." },
                    { status: 400 }
                );
            }

            mime = (file.type || "").toLowerCase();
            originalName = file.name || "attachment";
            finalSize = file.size;

            const ext = path.extname(originalName).toLowerCase();
            if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"].includes(ext)) {
                type = "image";
            } else if (mime.startsWith("video/") || [".mp4", ".mov", ".mkv", ".3gp", ".webm", ".avi"].includes(ext)) {
                type = "video";
            } else {
                type = "document";
            }

            const safeExt = ext || (type === "image" ? ".jpg" : type === "video" ? ".mp4" : ".bin");
            const cleanBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "file";
            savedFilename = `broadcast_${Date.now()}_${cleanBaseName}${safeExt}`;
            const filePath = path.join(mediaDir, savedFilename);

            // Stream directly from Web ReadableStream to disk file (avoids RAM spikes for Render 512MB)
            await pipeline(
                Readable.fromWeb(file.stream() as any),
                createWriteStream(filePath)
            );
        }

        // Async cleanup of old temporary files
        cleanupOldMedia(mediaDir).catch(() => {});

        const mediaUrl = `/api/media/${encodeURIComponent(savedFilename)}`;

        return NextResponse.json({
            status: true,
            message: "File uploaded successfully",
            data: {
                url: mediaUrl,
                fileUrl: mediaUrl,
                previewUrl: mediaUrl,
                filename: originalName,
                type,
                size: finalSize,
            }
        });
    } catch (error: any) {
        console.error("Upload error in /api/autobroadcast/upload:", error);
        return NextResponse.json({ status: false, message: error?.message || "Upload failed" }, { status: 400 });
    }
}

