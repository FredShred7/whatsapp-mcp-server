import { z } from "zod";
import axios from "axios";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { WhatsAppClient } from "../whatsapp/client.js";
import type { WhatsAppWebhook } from "../whatsapp/webhook.js";
import { WhatsAppError } from "../whatsapp/types.js";
import type { ToolDefinition } from "./messages.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const UploadMediaSchema = z.object({
  media_url: z
    .string()
    .url()
    .describe("Publicly accessible URL of the media file to upload to WhatsApp"),
  mime_type: z
    .string()
    .describe(
      "MIME type of the media file, e.g. image/jpeg, video/mp4, audio/ogg, application/pdf",
    ),
  filename: z
    .string()
    .optional()
    .describe("Optional filename for the uploaded file (used for documents)"),
});

const GetMediaUrlSchema = z.object({
  media_id: z
    .string()
    .describe("WhatsApp media ID returned when a media message is received or uploaded"),
});

const DeleteMediaSchema = z.object({
  media_id: z.string().describe("WhatsApp media ID of the media to delete"),
});

// ─── Supported MIME Types ─────────────────────────────────────────────────────

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SUPPORTED_VIDEO_TYPES = ["video/mp4", "video/3gpp"];
const SUPPORTED_AUDIO_TYPES = [
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
  "audio/opus",
];
const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const ALL_SUPPORTED = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_VIDEO_TYPES,
  ...SUPPORTED_AUDIO_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
];

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const mediaTools: ToolDefinition[] = [
  {
    name: "whatsapp_upload_media",
    description:
      "Upload a media file from a URL to WhatsApp and get back a media ID. The media ID can then be used to send media messages. Supports images (JPEG, PNG, WebP), videos (MP4, 3GPP), audio (AAC, MP4, MPEG, AMR, OGG), and documents (PDF, Word, Excel, PowerPoint, plain text).",
    inputSchema: {
      type: "object",
      properties: {
        media_url: {
          type: "string",
          description: "Publicly accessible URL of the media file to upload to WhatsApp",
        },
        mime_type: {
          type: "string",
          description:
            "MIME type of the media file, e.g. image/jpeg, video/mp4, audio/ogg, application/pdf",
        },
        filename: {
          type: "string",
          description: "Optional filename for the uploaded file (used for documents)",
        },
      },
      required: ["media_url", "mime_type"],
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = UploadMediaSchema.parse(args);

      if (!ALL_SUPPORTED.includes(params.mime_type)) {
        return (
          `Unsupported MIME type: ${params.mime_type}\n\n` +
          `Supported types:\n` +
          `• Images: ${SUPPORTED_IMAGE_TYPES.join(", ")}\n` +
          `• Videos: ${SUPPORTED_VIDEO_TYPES.join(", ")}\n` +
          `• Audio: ${SUPPORTED_AUDIO_TYPES.join(", ")}\n` +
          `• Documents: ${SUPPORTED_DOCUMENT_TYPES.join(", ")}`
        );
      }

      let tempDir: string | null = null;
      let tempFilePath: string | null = null;

      try {
        // Download the file to a temp location
        const response = await axios.get<Buffer>(params.media_url, {
          responseType: "arraybuffer",
          timeout: 60_000,
        });

        tempDir = mkdtempSync(join(tmpdir(), "whatsapp-"));
        const ext = mimeToExt(params.mime_type);
        const safeName = params.filename
          ? params.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
          : `upload.${ext}`;
        tempFilePath = join(tempDir, safeName);
        writeFileSync(tempFilePath, response.data as Buffer);

        const uploadResult = await client.uploadMedia(tempFilePath, params.mime_type);
        return `Media uploaded successfully.\n• Media ID: ${uploadResult.id}\n• You can now use this ID to send media messages without re-uploading.`;
      } catch (err) {
        return formatError(err);
      } finally {
        // Clean up temp file
        if (tempFilePath) {
          try {
            unlinkSync(tempFilePath);
          } catch {
            // ignore cleanup errors
          }
        }
        if (tempDir) {
          try {
            unlinkSync(tempDir);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    },
  },

  {
    name: "whatsapp_get_media_url",
    description:
      "Get the download URL for a WhatsApp media file using its media ID. The URL is temporary and expires after 5 minutes. Use this to download received media.",
    inputSchema: {
      type: "object",
      properties: {
        media_id: {
          type: "string",
          description:
            "WhatsApp media ID returned when a media message is received or uploaded",
        },
      },
      required: ["media_id"],
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = GetMediaUrlSchema.parse(args);
      try {
        const media = await client.getMediaUrl(params.media_id);
        return (
          `Media info for ID ${params.media_id}:\n` +
          `• URL: ${media.url}\n` +
          `• MIME type: ${media.mime_type}\n` +
          `• File size: ${formatBytes(media.file_size)}\n` +
          `• SHA256: ${media.sha256}\n` +
          `\nNote: This URL is temporary and expires in ~5 minutes. Download it promptly.`
        );
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_delete_media",
    description:
      "Delete a previously uploaded media file from WhatsApp servers using its media ID. This frees up storage and removes the file permanently.",
    inputSchema: {
      type: "object",
      properties: {
        media_id: {
          type: "string",
          description: "WhatsApp media ID of the media to delete",
        },
      },
      required: ["media_id"],
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = DeleteMediaSchema.parse(args);
      try {
        const result = await client.deleteMedia(params.media_id);
        if (result.deleted) {
          return `Media ${params.media_id} deleted successfully.`;
        }
        return `Delete request sent for media ${params.media_id}, but the API did not confirm deletion.`;
      } catch (err) {
        return formatError(err);
      }
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatError(err: unknown): string {
  if (err instanceof WhatsAppError) {
    return `WhatsApp API error (code ${err.code}): ${err.message}${err.fbtrace_id ? ` [trace: ${err.fbtrace_id}]` : ""}`;
  }
  if (err instanceof z.ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return `Invalid input: ${issues}`;
  }
  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }
  return `Unexpected error: ${String(err)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/amr": "amr",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
  };
  return map[mimeType] ?? "bin";
}
