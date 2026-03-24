import { z } from "zod";
import type { WhatsAppClient } from "../whatsapp/client.js";
import type { WhatsAppWebhook } from "../whatsapp/webhook.js";
import { WhatsAppError } from "../whatsapp/types.js";
import type { TemplateComponent } from "../whatsapp/types.js";
import type { ToolDefinition } from "./messages.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const TemplateParameterSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("currency"),
    currency: z.object({
      fallback_value: z.string(),
      code: z.string().length(3),
      amount_1000: z.number().int(),
    }),
  }),
  z.object({
    type: z.literal("date_time"),
    date_time: z.object({ fallback_value: z.string() }),
  }),
  z.object({
    type: z.literal("image"),
    image: z.object({
      id: z.string().optional(),
      link: z.string().url().optional(),
      caption: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("document"),
    document: z.object({
      id: z.string().optional(),
      link: z.string().url().optional(),
      caption: z.string().optional(),
      filename: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("video"),
    video: z.object({
      id: z.string().optional(),
      link: z.string().url().optional(),
      caption: z.string().optional(),
    }),
  }),
]);

const TemplateButtonParameterSchema = z.union([
  z.object({ type: z.literal("payload"), payload: z.string() }),
  z.object({ type: z.literal("text"), text: z.string() }),
]);

const TemplateComponentSchema = z.union([
  z.object({
    type: z.literal("header"),
    parameters: z.array(TemplateParameterSchema),
  }),
  z.object({
    type: z.literal("body"),
    parameters: z.array(TemplateParameterSchema),
  }),
  z.object({
    type: z.literal("button"),
    sub_type: z.enum(["quick_reply", "url", "call_to_action"]),
    index: z.number().int().min(0),
    parameters: z.array(TemplateButtonParameterSchema),
  }),
]);

const SendTemplateSchema = z.object({
  to: z
    .string()
    .min(7)
    .describe("Recipient phone number in E.164 format, e.g. +15551234567"),
  template_name: z.string().describe("Name of the approved template to send"),
  language_code: z
    .string()
    .describe("Language code for the template, e.g. en_US, pt_BR, es, fr"),
  components: z
    .array(TemplateComponentSchema)
    .optional()
    .describe(
      "Template components with dynamic values. Include header, body, and/or button components as needed.",
    ),
  reply_to_message_id: z.string().optional().describe("Message ID to reply to"),
});

const ListTemplatesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Maximum number of templates to return (default 20, max 100)"),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const templateTools: ToolDefinition[] = [
  {
    name: "whatsapp_send_template",
    description:
      "Send an approved WhatsApp message template. Templates are pre-approved messages used for business-initiated conversations. Supports header, body, and button components with dynamic variable substitution.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number in E.164 format, e.g. +15551234567",
        },
        template_name: {
          type: "string",
          description: "Name of the approved template to send",
        },
        language_code: {
          type: "string",
          description: "Language code for the template, e.g. en_US, pt_BR, es, fr",
        },
        components: {
          type: "array",
          description:
            "Template components with dynamic values. Include header, body, and/or button components as needed.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["header", "body", "button"],
              },
              sub_type: {
                type: "string",
                enum: ["quick_reply", "url", "call_to_action"],
                description: "Required for button components",
              },
              index: {
                type: "number",
                description: "Button index (0-based), required for button components",
              },
              parameters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["text", "currency", "date_time", "image", "document", "video"],
                    },
                    text: { type: "string" },
                    payload: { type: "string" },
                  },
                  required: ["type"],
                },
              },
            },
            required: ["type"],
          },
        },
        reply_to_message_id: {
          type: "string",
          description: "Message ID to reply to",
        },
      },
      required: ["to", "template_name", "language_code"],
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, webhook?: WhatsAppWebhook) => {
      const params = SendTemplateSchema.parse(args);
      try {
        const result = await client.sendTemplateMessage(
          params.to,
          params.template_name,
          params.language_code,
          params.components as TemplateComponent[] | undefined,
          params.reply_to_message_id,
        );
        const messageId = result.messages[0]?.id ?? "unknown";
        webhook?.addOutboundMessage(
          params.to,
          messageId,
          "template",
          `[template: ${params.template_name}]`,
        );
        return (
          `Template message sent successfully.\n` +
          `• Message ID: ${messageId}\n` +
          `• Template: ${params.template_name} (${params.language_code})\n` +
          `• Recipient: ${result.contacts[0]?.wa_id ?? params.to}`
        );
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_list_templates",
    description:
      "List available WhatsApp message templates for your business account. Shows template name, status (APPROVED/PENDING/REJECTED), category, and language. Requires WHATSAPP_BUSINESS_ACCOUNT_ID to be configured.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of templates to return (default 20, max 100)",
        },
      },
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = ListTemplatesSchema.parse(args);
      try {
        const response = await client.listMessageTemplates(params.limit);
        if (!response.data || response.data.length === 0) {
          return "No message templates found. Create templates in the Meta Business Manager at business.facebook.com.";
        }
        const lines = response.data.map((t) => {
          const statusEmoji =
            t.status === "APPROVED" ? "✓" : t.status === "PENDING" ? "⏳" : "✗";
          return (
            `• ${statusEmoji} ${t.name} [${t.language}]\n` +
            `  Status: ${t.status} | Category: ${t.category}\n` +
            `  Components: ${t.components.map((c) => c.type).join(", ")}`
          );
        });
        return (
          `Message Templates (${response.data.length} found):\n\n` +
          lines.join("\n\n") +
          (response.paging?.next
            ? `\n\nMore templates available. Increase limit to see more.`
            : "")
        );
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
  return `Unexpected error: ${(err as Error).message ?? String(err)}`;
}
