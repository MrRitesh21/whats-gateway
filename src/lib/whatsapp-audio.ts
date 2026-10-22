import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

let cachedFfmpegPath: string | null = null;

/**
 * Locate ffmpeg binary on the host system (macOS Homebrew, Linux, Docker, standard PATH)
 */
export function getFfmpegPath(): string | null {
    if (cachedFfmpegPath) return cachedFfmpegPath;

    const candidates = [
        "ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ];

    for (const bin of candidates) {
        try {
            if (bin === "ffmpeg") {
                const { execSync } = require("child_process");
                execSync("ffmpeg -version", { stdio: "ignore" });
                cachedFfmpegPath = "ffmpeg";
                return cachedFfmpegPath;
            } else if (fs.existsSync(bin)) {
                cachedFfmpegPath = bin;
                return cachedFfmpegPath;
            }
        } catch {
            // Check next candidate
        }
    }

    return null;
}

/**
 * Verify if an audio buffer is already a valid OGG OPUS stream.
 * WhatsApp requires both the 'OggS' container header and 'OpusHead' packet.
 */
export function isOggOpus(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 36) return false;
    if (buffer.subarray(0, 4).toString() !== "OggS") return false;
    return buffer.includes(Buffer.from("OpusHead"));
}

export interface WhatsAppAudioPayload {
    buffer: Buffer;
    mimetype: string;
    ptt: boolean;
}

/**
 * Transcode any audio file (MP3, WAV, AAC, M4A, WebM, AMR) to 100% WhatsApp-compatible OGG Opus.
 * 
 * WhatsApp requirement for Voice Notes (PTT):
 * - Container: OGG
 * - Codec: OPUS
 * - Sampling rate: 48000 Hz
 * - Channels: 1 (mono)
 * - Mimetype: "audio/ogg; codecs=opus"
 * 
 * If transcoding is not possible (ffmpeg unavailable), falls back safely to regular audio
 * with matching MIME type and `ptt: false` so WhatsApp native player can still play it.
 */
export async function convertToWhatsAppAudio(
    input: Buffer | string | { url: string },
    preferPtt: boolean = true
): Promise<WhatsAppAudioPayload> {
    let sourceBuffer: Buffer | null = null;
    let sourcePath: string | null = null;
    let tempInputPath: string | null = null;

    try {
        if (typeof input === "object" && input !== null && "url" in input) {
            const urlVal = input.url;
            if (urlVal.startsWith("http://") || urlVal.startsWith("https://")) {
                const res = await fetch(urlVal);
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching media URL`);
                sourceBuffer = Buffer.from(await res.arrayBuffer());
            } else if (fs.existsSync(urlVal)) {
                sourcePath = urlVal;
            } else {
                sourceBuffer = await fsp.readFile(urlVal);
            }
        } else if (typeof input === "string") {
            if (input.startsWith("http://") || input.startsWith("https://")) {
                const res = await fetch(input);
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching media URL`);
                sourceBuffer = Buffer.from(await res.arrayBuffer());
            } else if (input.startsWith("data:")) {
                const commaIdx = input.indexOf(",");
                sourceBuffer = Buffer.from(commaIdx >= 0 ? input.slice(commaIdx + 1) : input, "base64");
            } else if (fs.existsSync(input)) {
                sourcePath = input;
            } else {
                sourceBuffer = await fsp.readFile(input);
            }
        } else if (Buffer.isBuffer(input)) {
            sourceBuffer = input;
        }

        // Check if already compliant OGG Opus
        if (sourceBuffer && isOggOpus(sourceBuffer)) {
            return {
                buffer: sourceBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: preferPtt,
            };
        }

        if (sourcePath && !sourceBuffer) {
            // Read first 200 bytes to check if already OGG Opus without reading full file
            const fd = await fsp.open(sourcePath, "r");
            const headBuf = Buffer.alloc(200);
            await fd.read(headBuf, 0, 200, 0);
            await fd.close();
            if (isOggOpus(headBuf)) {
                const fullBuf = await fsp.readFile(sourcePath);
                return {
                    buffer: fullBuf,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: preferPtt,
                };
            }
        }

        const ffmpeg = getFfmpegPath();
        if (!ffmpeg) {
            console.warn("[WhatsAppAudio] ffmpeg binary not found on system. Sending as standard audio.");
            const fallbackBuf = sourceBuffer || (sourcePath ? await fsp.readFile(sourcePath) : Buffer.alloc(0));
            return getFallbackAudioPayload(fallbackBuf, sourcePath);
        }

        // Prepare input path for ffmpeg
        if (!sourcePath && sourceBuffer) {
            tempInputPath = path.join(os.tmpdir(), `wa_in_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
            await fsp.writeFile(tempInputPath, sourceBuffer);
            sourcePath = tempInputPath;
        }

        if (!sourcePath) {
            throw new Error("No valid audio source to transcode");
        }

        const tempOutputPath = path.join(os.tmpdir(), `wa_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);

        try {
            // Transcode to WhatsApp-standard OGG Opus:
            // -vn: discard video/album art
            // -c:a libopus: encode with libopus
            // -b:a 48k: voice-optimized bitrate (compact and crisp)
            // -ar 48000: standard sample rate expected by WhatsApp opus decoder
            // -ac 1: mono (mandatory for clean voice note waveform and playback)
            // -f ogg: ogg container
            await execFileAsync(ffmpeg, [
                "-y",
                "-i", sourcePath,
                "-vn",
                "-c:a", "libopus",
                "-b:a", "48k",
                "-ar", "48000",
                "-ac", "1",
                "-f", "ogg",
                tempOutputPath
            ]);

            const transcodedBuffer = await fsp.readFile(tempOutputPath);
            await fsp.unlink(tempOutputPath).catch(() => {});

            if (transcodedBuffer.length > 0 && isOggOpus(transcodedBuffer)) {
                return {
                    buffer: transcodedBuffer,
                    mimetype: "audio/ogg; codecs=opus",
                    ptt: preferPtt,
                };
            }
        } catch (transcodeErr) {
            console.error("[WhatsAppAudio] FFmpeg transcoding failed:", transcodeErr);
            await fsp.unlink(tempOutputPath).catch(() => {});
        }

        // If ffmpeg failed, return safe fallback
        const fallbackBuf = sourceBuffer || (sourcePath ? await fsp.readFile(sourcePath) : Buffer.alloc(0));
        return getFallbackAudioPayload(fallbackBuf, sourcePath);

    } finally {
        if (tempInputPath) {
            await fsp.unlink(tempInputPath).catch(() => {});
        }
    }
}

/**
 * Safe fallback when ffmpeg is unavailable or failed:
 * Prevents setting `ptt: true` on non-opus audio, which crashes recipient WhatsApp player.
 */
function getFallbackAudioPayload(buffer: Buffer, originalPath: string | null): WhatsAppAudioPayload {
    const ext = originalPath ? path.extname(originalPath).toLowerCase() : "";
    let mimetype = "audio/mpeg";

    if (ext === ".mp3") mimetype = "audio/mpeg";
    else if (ext === ".m4a" || ext === ".aac") mimetype = "audio/mp4";
    else if (ext === ".ogg") mimetype = "audio/ogg";
    else if (ext === ".wav") mimetype = "audio/wav";
    else if (ext === ".webm") mimetype = "audio/webm";

    return {
        buffer,
        mimetype,
        ptt: false, // Must be false so WhatsApp uses standard audio player instead of voice note decoder
    };
}
