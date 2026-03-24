import { z } from "zod";
import type { WhatsAppClient } from "../whatsapp/client.js";
import type { WhatsAppWebhook } from "../whatsapp/webhook.js";
import { WhatsAppError } from "../whatsapp/types.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const PhoneSchema = z.string().min(7).describe("Phone number in E.164 format, e.g. +15551234567");

const SendTextSchema = z.object({
  to: PhoneSchema,
  text: z.string().min(1).max(4096).describe("Message text (max 4096 characters)"),
  preview_url: z.boolean().optional().describe("Whether to show URL previews"),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const SendImageSchema = z.object({
  to: PhoneSchema,
  image_url: z.string().url().describe("Publicly accessible URL of the image"),
  caption: z.string().max(1024).optional().describe("Optional caption (max 1024 characters)"),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const SendVideoSchema = z.object({
  to: PhoneSchema,
  video_url: z.string().url().describe("Publicly accessible URL of the video"),
  caption: z.string().max(1024).optional().describe("Optional caption (max 1024 characters)"),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const SendAudioSchema = z.object({
  to: PhoneSchema,
  audio_url: z.string().url().describe("Publicly accessible URL of the audio file"),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const SendDocumentSchema = z.object({
  to: PhoneSchema,
  document_url: z.string().url().describe("Publicly accessible URL of the document"),
  caption: z.string().max(1024).optional().describe("Optional caption"),
  filename: z.string().optional().describe("Filename shown to recipient"),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const SendReactionSchema = z.object({
  to: PhoneSchema,
  message_id: z.string().describe("ID of the message to react to"),
  emoji: z.string().describe("Emoji to use as reaction, e.g. 👍"),
});

const MarkReadSchema = z.object({
  message_id: z.string().describe("ID of the message to mark as read"),
});

const ListConversationsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Maximum number of conversations to return (default 20)"),
});

const GetConversationSchema = z.object({
  phone_number: PhoneSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe("Maximum number of messages to return (default 50)"),
});

const GetMessageStatusSchema = z.object({
  message_id: z.string().describe("ID of the sent message"),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>, client: WhatsAppClient, webhook?: WhatsAppWebhook) => Promise<string>;
}

export const messageTools: ToolDefinition[] = [
  {
    name: "whatsapp_send_text",
    description:
      "Send a text message to a WhatsApp phone number. Supports up to 4096 characters and optional URL preview.",
    inputSchema: zodToJsonSchema(SendTextSchema),
    handler: async (args, client, webhook) => {
      const params = SendTextSchema.parse(args);
      try {
        const result = await client.sendTextMessage(
          params.to,
          params.text,
          params.preview_url,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(params.to, messageId, "text", params.text);
        return `Message sent successfully. Message ID: ${messageId}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_send_image",
    description:
      "Send an image message to a WhatsApp phone number. Provide a publicly accessible image URL.",
    inputSchema: zodToJsonSchema(SendImageSchema),
    handler: async (args, client, webhook) => {
      const params = SendImageSchema.parse(args);
      try {
        const result = await client.sendImageMessage(
          params.to,
          params.image_url,
          params.caption,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(
          params.to,
          messageId,
          "image",
          params.caption ?? params.image_url,
        );
        return `Image sent successfully. Message ID: ${messageId}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_send_video",
    description:
      "Send a video message to a WhatsApp phone number. Provide a publicly accessible video URL.",
    inputSchema: zodToJsonSchema(SendVideoSchema),
    handler: async (args, client, webhook) => {
      const params = SendVideoSchema.parse(args);
      try {
        const result = await client.sendVideoMessage(
          params.to,
          params.video_url,
          params.caption,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(
          params.to,
          messageId,
          "video",
          params.caption ?? params.video_url,
        );
        return `Video sent successfully. Message ID: ${messageId}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_send_audio",
    description: "Send an audio message to a WhatsApp phone number. Provide a publicly accessible audio URL.",
    inputSchema: zodToJsonSchema(SendAudioSchema),
    handler: async (args, client, webhook) => {
      const params = SendAudioSchema.parse(args);
      try {
        const result = await client.sendAudioMessage(
          params.to,
          params.audio_url,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(params.to, messageId, "audio", params.audio_url);
        return `Audio sent successfully. Message ID: ${messageId}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_send_document",
    description:
      "Send a document or file to a WhatsApp phone number. Supports PDF, Word, Excel, and other common formats.",
    inputSchema: zodToJsonSchema(SendDocumentSchema),
    handler: async (args, client, webhook) => {
      const params = SendDocumentSchema.parse(args);
      try {
        const result = await client.sendDocumentMessage(
          params.to,
          params.document_url,
          params.caption,
          params.filename,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(
          params.to,
          messageId,
          "document",
          params.filename ?? params.document_url,
        );
        return `Document sent successfully. Message ID: ${messageId}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_send_reaction",
    description: "React to a WhatsApp message with an emoji.",
    inputSchema: zodToJsonSchema(SendReactionSchema),
    handler: async (args, client) => {
      const params = SendReactionSchema.parse(args);
      try {
        await client.sendReaction(params.to, params.message_id, params.emoji);
        return `Reaction ${params.emoji} sent to message ${params.message_id}`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_mark_read",
    description:
      "Mark an incoming WhatsApp message as read. This sends a read receipt to the sender.",
    inputSchema: zodToJsonSchema(MarkReadSchema),
    handler: async (args, client) => {
      const params = MarkReadSchema.parse(args);
      try {
        await client.markMessageAsRead(params.message_id);
        return `Message ${params.message_id} marked as read.`;
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_list_conversations",
    description:
      "List recent WhatsApp conversations. Only available when the webhook server is running and has received messages.",
    inputSchema: zodToJsonSchema(ListConversationsSchema),
    handler: async (args, _client, webhook) => {
      const params = ListConversationsSchema.parse(args);
      if (!webhook) {
        return "Conversation history is only available when the webhook server is running (set WEBHOOK_PORT in your environment).";
      }
      const conversations = webhook.getConversations().slice(0, params.limit);
      if (conversations.length === 0) {
        return "No conversations found. Messages will appear here after the webhook receives them.";
      }
      const lines = conversations.map((c) => {
        const name = c.displayName ? `${c.displayName} (${c.phoneNumber})` : c.phoneNumber;
        const last = c.messages.at(-1);
        const preview = last
          ? `${last.direction === "inbound" ? "←" : "→"} ${last.content.slice(0, 60)}`
          : "no messages";
        return `• ${name} — ${preview} [${c.lastActivity.toISOString()}]`;
      });
      return `Recent conversations (${conversations.length}):\n\n${lines.join("\n")}`;
    },
  },

  {
    name: "whatsapp_get_conversation",
    description:
      "Get the message history for a conversation with a specific phone number. Requires webhook server.",
    inputSchema: zodToJsonSchema(GetConversationSchema),
    handler: async (args, _client, webhook) => {
      const params = GetConversationSchema.parse(args);
      if (!webhook) {
        return "Conversation history is only available when the webhook server is running (set WEBHOOK_PORT in your environment).";
      }
      const conversation = webhook.getConversation(params.phone_number);
      if (!conversation) {
        return `No conversation found with ${params.phone_number}. Messages will appear here after the webhook receives them.`;
      }
      const messages = conversation.messages.slice(-params.limit);
      const lines = messages.map((m) => {
        const direction = m.direction === "inbound" ? "←" : "→";
        const time = m.timestamp.toISOString();
        return `[${time}] ${direction} [${m.type}] ${m.content}`;
      });
      const name = conversation.displayName
        ? `${conversation.displayName} (${conversation.phoneNumber})`
        : conversation.phoneNumber;
      return `Conversation with ${name} — last ${messages.length} message(s):\n\n${lines.join("\n")}`;
    },
  },

  {
    name: "whatsapp_get_message_status",
    description:
      "Get the delivery/read status of a previously sent message. Requires webhook server for live updates.",
    inputSchema: zodToJsonSchema(GetMessageStatusSchema),
    handler: async (args, _client, webhook) => {
      const params = GetMessageStatusSchema.parse(args);
      if (!webhook) {
        return "Message status tracking requires the webhook server to be running (set WEBHOOK_PORT in your environment).";
      }
      const status = webhook.getMessageStatus(params.message_id);
      if (!status) {
        return `No status found for message ${params.message_id}. The message may not have been sent through this session, or no status update has been received yet.`;
      }
      return `Message ${params.message_id} status: ${status}`;
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
  return `Unexpected error: ${(err as Error).message ?? String(err)}`;
}

function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): object {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(value as z.ZodTypeAny);
    if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): object {
  if (field instanceof z.ZodOptional) {
    return zodFieldToJsonSchema(field.unwrap());
  }
  if (field instanceof z.ZodDefault) {
    return zodFieldToJsonSchema(field.removeDefault());
  }
  if (field instanceof z.ZodString) {
    const schema: Record<string, unknown> = { type: "string" };
    const description = field.description;
    if (description) schema.description = description;
    return schema;
  }
  if (field instanceof z.ZodNumber) {
    const schema: Record<string, unknown> = { type: "number" };
    const description = field.description;
    if (description) schema.description = description;
    return schema;
  }
  if (field instanceof z.ZodBoolean) {
    const schema: Record<string, unknown> = { type: "boolean" };
    const description = field.description;
    if (description) schema.description = description;
    return schema;
  }
  if (field instanceof z.ZodArray) {
    return { type: "array", items: zodFieldToJsonSchema(field.element) };
  }
  if (field instanceof z.ZodObject) {
    return zodToJsonSchema(field as z.ZodObject<z.ZodRawShape>);
  }
  return { type: "string" };
}
