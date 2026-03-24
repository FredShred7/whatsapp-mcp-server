import { z } from "zod";
import type { WhatsAppClient } from "../whatsapp/client.js";
import type { WhatsAppWebhook } from "../whatsapp/webhook.js";
import { WhatsAppError } from "../whatsapp/types.js";
import type { ToolDefinition } from "./messages.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const GetContactSchema = z.object({
  phone_number: z
    .string()
    .min(7)
    .describe(
      "Phone number to look up in E.164 format (e.g. +15551234567). Returns WhatsApp ID and validity status.",
    ),
});

const GetBusinessProfileSchema = z.object({});

const UpdateBusinessProfileSchema = z.object({
  about: z
    .string()
    .max(139)
    .optional()
    .describe("Business about text (max 139 characters)"),
  address: z.string().max(256).optional().describe("Business address"),
  description: z.string().max(512).optional().describe("Business description (max 512 characters)"),
  email: z.string().email().optional().describe("Business email address"),
  websites: z
    .array(z.string().url())
    .max(2)
    .optional()
    .describe("Up to 2 website URLs for the business"),
  vertical: z
    .enum([
      "UNDEFINED",
      "OTHER",
      "AUTO",
      "BEAUTY",
      "APPAREL",
      "EDU",
      "ENTERTAIN",
      "EVENT_PLAN",
      "FINANCE",
      "GROCERY",
      "GOVT",
      "HOTEL",
      "HEALTH",
      "NONPROFIT",
      "PROF_SERVICES",
      "RETAIL",
      "TRAVEL",
      "RESTAURANT",
      "NOT_A_BIZ",
    ])
    .optional()
    .describe("Business vertical / industry category"),
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const contactTools: ToolDefinition[] = [
  {
    name: "whatsapp_get_contact",
    description:
      "Look up a phone number to check if it has a WhatsApp account and retrieve the WhatsApp ID. Useful before sending messages to validate numbers.",
    inputSchema: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description:
            "Phone number to look up in E.164 format (e.g. +15551234567). Returns WhatsApp ID and validity status.",
        },
      },
      required: ["phone_number"],
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = GetContactSchema.parse(args);
      try {
        const contact = await client.getContactInfo(params.phone_number);
        if (contact.status === "valid") {
          return `Contact found:\n• Input: ${contact.input}\n• WhatsApp ID (wa_id): ${contact.wa_id}\n• Status: valid`;
        } else {
          return `Phone number ${params.phone_number} does not appear to have a WhatsApp account (status: ${contact.status}).`;
        }
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_get_business_profile",
    description:
      "Retrieve the WhatsApp Business profile for your connected phone number, including about text, address, description, email, and website.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      GetBusinessProfileSchema.parse(args);
      try {
        const profile = await client.getBusinessProfile();
        const lines: string[] = ["Business Profile:"];
        if (profile.about) lines.push(`• About: ${profile.about}`);
        if (profile.address) lines.push(`• Address: ${profile.address}`);
        if (profile.description) lines.push(`• Description: ${profile.description}`);
        if (profile.email) lines.push(`• Email: ${profile.email}`);
        if (profile.websites?.length) lines.push(`• Websites: ${profile.websites.join(", ")}`);
        if (profile.vertical) lines.push(`• Vertical: ${profile.vertical}`);
        if (profile.profile_picture_url)
          lines.push(`• Profile Picture: ${profile.profile_picture_url}`);
        if (lines.length === 1) lines.push("(No profile information set yet)");
        return lines.join("\n");
      } catch (err) {
        return formatError(err);
      }
    },
  },

  {
    name: "whatsapp_update_business_profile",
    description:
      "Update your WhatsApp Business profile. You can update the about text, address, description, email, website URLs, and business vertical.",
    inputSchema: {
      type: "object",
      properties: {
        about: {
          type: "string",
          description: "Business about text (max 139 characters)",
        },
        address: {
          type: "string",
          description: "Business address",
        },
        description: {
          type: "string",
          description: "Business description (max 512 characters)",
        },
        email: {
          type: "string",
          description: "Business email address",
        },
        websites: {
          type: "array",
          items: { type: "string" },
          description: "Up to 2 website URLs for the business",
        },
        vertical: {
          type: "string",
          enum: [
            "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", "ENTERTAIN",
            "EVENT_PLAN", "FINANCE", "GROCERY", "GOVT", "HOTEL", "HEALTH",
            "NONPROFIT", "PROF_SERVICES", "RETAIL", "TRAVEL", "RESTAURANT", "NOT_A_BIZ",
          ],
          description: "Business vertical / industry category",
        },
      },
    },
    handler: async (args: Record<string, unknown>, client: WhatsAppClient, _webhook?: WhatsAppWebhook) => {
      const params = UpdateBusinessProfileSchema.parse(args);
      const updates = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(updates).length === 0) {
        return "No fields provided to update. Please specify at least one field (about, address, description, email, websites, or vertical).";
      }
      try {
        await client.updateBusinessProfile(updates);
        const updated = Object.entries(updates)
          .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\n");
        return `Business profile updated successfully:\n${updated}`;
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
