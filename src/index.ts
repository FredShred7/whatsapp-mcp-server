#!/usr/bin/env node
import "dotenv/config";
import { WhatsAppClient } from "./whatsapp/client.js";
import { WhatsAppWebhook } from "./whatsapp/webhook.js";
import { startMcpServer } from "./server.js";
import type { WhatsAppConfig } from "./whatsapp/types.js";

// ─── Validate required env vars ───────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[startup] Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env and fill in your credentials.`,
    );
    process.exit(1);
  }
  return value;
}

// ─── Build config ─────────────────────────────────────────────────────────────

const config: WhatsAppConfig = {
  phoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),
  accessToken: requireEnv("WHATSAPP_ACCESS_TOKEN"),
  webhookVerifyToken: process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] ?? "",
  businessAccountId: process.env["WHATSAPP_BUSINESS_ACCOUNT_ID"],
  apiVersion: process.env["WHATSAPP_API_VERSION"] ?? "v21.0",
  baseUrl: "https://graph.facebook.com",
};

// ─── Initialise WhatsApp client ───────────────────────────────────────────────

const whatsappClient = new WhatsAppClient(config);

// ─── Optionally start webhook server ─────────────────────────────────────────

let webhook: WhatsAppWebhook | undefined;

const webhookPortStr = process.env["WEBHOOK_PORT"];
if (webhookPortStr) {
  const port = parseInt(webhookPortStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`[startup] Invalid WEBHOOK_PORT "${webhookPortStr}" — must be a valid port number (1–65535)`);
    process.exit(1);
  }

  if (!config.webhookVerifyToken) {
    console.error(
      `[startup] WHATSAPP_WEBHOOK_VERIFY_TOKEN is required when running the webhook server. ` +
        `Set it to a random secret string and configure the same value in the Meta App Dashboard.`,
    );
    process.exit(1);
  }

  webhook = new WhatsAppWebhook({
    verifyToken: config.webhookVerifyToken,
    port,
    path: process.env["WEBHOOK_PATH"] ?? "/webhook",
  });

  webhook.on("message", (message) => {
    console.error(`[webhook] New message from ${message.from}: ${message.content}`);
  });

  webhook.on("status", (status) => {
    console.error(`[webhook] Status update for ${status.id}: ${status.status}`);
  });

  await webhook.start();
}

// ─── Start MCP server ─────────────────────────────────────────────────────────

await startMcpServer(whatsappClient, webhook);
