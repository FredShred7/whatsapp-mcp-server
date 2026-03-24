# whatsapp-mcp-server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)
[![WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp-Cloud%20API%20v21.0-25D366?logo=whatsapp)](https://developers.facebook.com/docs/whatsapp/cloud-api)

A production-ready **Model Context Protocol (MCP) server** that connects AI assistants like Claude to the **WhatsApp Cloud API** (Meta). Send messages, manage conversations, handle media, send template messages, and receive real-time webhooks — all through natural language.

---

## Features

- **Send all message types** — text, images, videos, audio, documents, reactions
- **Template messages** — send and list approved WhatsApp Business templates with full component support
- **Media management** — upload, retrieve, and delete media files
- **Conversation history** — in-memory store of recent conversations via webhook
- **Real-time webhooks** — receive incoming messages and delivery status updates
- **Business profile** — read and update your WhatsApp Business profile
- **Contact lookup** — validate phone numbers against WhatsApp
- **Rate limit handling** — automatic exponential backoff retry logic
- **Type-safe** — fully typed TypeScript with Zod input validation
- **Docker ready** — multi-stage Dockerfile and docker-compose included
- **Works without webhook** — send-only mode with no webhook server required

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Assistant (Claude)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP Protocol (stdio)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  whatsapp-mcp-server                         │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  MCP Server │  │   Tools      │  │  WhatsApp Client  │  │
│  │  (stdio)    │◄─┤  messages    ├─►│  (Axios + retry)  │  │
│  │             │  │  contacts    │  └────────┬──────────┘  │
│  └─────────────┘  │  media       │           │              │
│                   │  templates   │           │ HTTPS        │
│  ┌─────────────┐  └──────────────┘           │              │
│  │  Webhook    │                             ▼              │
│  │  Server     │  ◄──── Incoming   ┌─────────────────────┐ │
│  │  (Express)  │       messages    │ WhatsApp Cloud API  │ │
│  └──────┬──────┘       & statuses  │  graph.facebook.com  │ │
└─────────│───────────────────────────┼─────────────────────┘ │
          │                           │                        │
          │ HTTP POST (Meta webhooks) │ HTTPS (send messages)  │
          │                           │                        │
     ┌────▼──────────────────────────▼──────────────┐
     │            WhatsApp Users                     │
     └────────────────────────────────────────────────┘

Webhook flow for incoming messages:
WhatsApp User → Meta Servers → POST /webhook → WhatsAppWebhook
→ in-memory conversation store → EventEmitter → MCP tools
```

---

## Prerequisites

1. **Node.js 20+** — [download](https://nodejs.org)
2. **Meta Developer Account** — [create one](https://developers.facebook.com/)
3. **WhatsApp Business App** configured in Meta App Dashboard
4. **Phone Number ID** and **Access Token** from your WhatsApp app settings
5. *(Optional)* A public HTTPS URL for receiving webhooks (use ngrok for local dev)

---

## Quick Start

**Step 1 — Clone and install:**
```bash
git clone https://github.com/FredShred7/whatsapp-mcp-server.git
cd whatsapp-mcp-server
npm install
```

**Step 2 — Configure credentials:**
```bash
cp .env.example .env
# Edit .env with your WhatsApp credentials
```

**Step 3 — Build:**
```bash
npm run build
```

**Step 4 — Add to Claude Desktop or Claude Code** (see sections below)

**Step 5 — Test it:**
Ask Claude: *"Send a WhatsApp message to +15551234567 saying Hello from Claude!"*

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Your WhatsApp phone number ID (from Meta App Dashboard > WhatsApp > API Setup) |
| `WHATSAPP_ACCESS_TOKEN` | Yes | Permanent access token for your app (generate in Meta App Dashboard) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook | Random secret string — must match what you enter in Meta App Dashboard |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional | WhatsApp Business Account ID — required for listing phone numbers and templates |
| `WHATSAPP_API_VERSION` | Optional | WhatsApp Cloud API version (default: `v21.0`) |
| `WEBHOOK_PORT` | Optional | Port for incoming webhook server (default: off). Set to `3000` to enable |
| `WEBHOOK_PATH` | Optional | HTTP path for webhooks (default: `/webhook`) |
| `LOG_LEVEL` | Optional | Logging verbosity: `info` or `debug` (default: `info`) |

---

## Available Tools

| Tool | Description | Key Parameters |
|---|---|---|
| `whatsapp_send_text` | Send a text message | `to`, `text`, `preview_url?`, `reply_to_message_id?` |
| `whatsapp_send_image` | Send an image with optional caption | `to`, `image_url`, `caption?` |
| `whatsapp_send_video` | Send a video with optional caption | `to`, `video_url`, `caption?` |
| `whatsapp_send_audio` | Send an audio message | `to`, `audio_url` |
| `whatsapp_send_document` | Send a document/file | `to`, `document_url`, `caption?`, `filename?` |
| `whatsapp_send_reaction` | React to a message with emoji | `to`, `message_id`, `emoji` |
| `whatsapp_mark_read` | Mark a message as read | `message_id` |
| `whatsapp_list_conversations` | List recent conversations (webhook required) | `limit?` |
| `whatsapp_get_conversation` | Get messages with a contact (webhook required) | `phone_number`, `limit?` |
| `whatsapp_get_message_status` | Get delivery/read status (webhook required) | `message_id` |
| `whatsapp_get_contact` | Validate a phone number on WhatsApp | `phone_number` |
| `whatsapp_get_business_profile` | Get your WhatsApp Business profile | — |
| `whatsapp_update_business_profile` | Update business profile info | `about?`, `address?`, `description?`, `email?`, `websites?`, `vertical?` |
| `whatsapp_upload_media` | Upload media from URL, get media ID | `media_url`, `mime_type`, `filename?` |
| `whatsapp_get_media_url` | Get temporary download URL for media | `media_id` |
| `whatsapp_delete_media` | Delete uploaded media | `media_id` |
| `whatsapp_send_template` | Send an approved template message | `to`, `template_name`, `language_code`, `components?` |
| `whatsapp_list_templates` | List available message templates | `limit?` |

---

## Usage with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/whatsapp-mcp-server/dist/index.js"],
      "env": {
        "WHATSAPP_PHONE_NUMBER_ID": "your_phone_number_id",
        "WHATSAPP_ACCESS_TOKEN": "your_access_token",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "your_verify_token",
        "WHATSAPP_BUSINESS_ACCOUNT_ID": "your_business_account_id",
        "WEBHOOK_PORT": "3000"
      }
    }
  }
}
```

Restart Claude Desktop after saving. You should see the WhatsApp tools available in the tools panel.

---

## Usage with Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project-level `.claude/settings.json`):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/absolute/path/to/whatsapp-mcp-server/dist/index.js"],
      "env": {
        "WHATSAPP_PHONE_NUMBER_ID": "your_phone_number_id",
        "WHATSAPP_ACCESS_TOKEN": "your_access_token",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN": "your_verify_token",
        "WHATSAPP_BUSINESS_ACCOUNT_ID": "your_business_account_id",
        "WEBHOOK_PORT": "3000"
      }
    }
  }
}
```

Or use the CLI to add it:
```bash
claude mcp add whatsapp node /absolute/path/to/whatsapp-mcp-server/dist/index.js
```

---

## Webhook Setup

Webhooks allow you to **receive** incoming messages and delivery status updates. They are optional — the MCP server works without them for sending messages only.

### Local development with ngrok

```bash
# 1. Install ngrok: https://ngrok.com/download
# 2. Start your webhook server
WEBHOOK_PORT=3000 npm run dev

# 3. In another terminal, expose it publicly
ngrok http 3000

# 4. Copy the HTTPS URL (e.g. https://abc123.ngrok.io)
```

### Configure in Meta App Dashboard

1. Go to [Meta App Dashboard](https://developers.facebook.com/apps/) > Your App > WhatsApp > Configuration
2. Set **Callback URL** to: `https://your-ngrok-url.ngrok.io/webhook`
3. Set **Verify Token** to match your `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Click **Verify and Save**
5. Subscribe to the **messages** webhook field

### Production

For production, deploy this server behind a reverse proxy (nginx, Caddy, etc.) with a valid TLS certificate. Set `WEBHOOK_PORT` to your internal port and expose it via HTTPS on port 443.

---

## Docker Deployment

### Build and run with docker-compose

```bash
# Copy and fill in your credentials
cp .env.example .env

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Build manually

```bash
# Build image
docker build -t whatsapp-mcp-server .

# Run (send-only, no webhook)
docker run --rm -i \
  -e WHATSAPP_PHONE_NUMBER_ID=xxx \
  -e WHATSAPP_ACCESS_TOKEN=xxx \
  whatsapp-mcp-server

# Run with webhook server
docker run --rm -i \
  -p 3000:3000 \
  --env-file .env \
  whatsapp-mcp-server
```

**Note:** When using Docker with Claude Desktop/Code, the MCP transport uses stdio. Make sure to pass `-i` (interactive) so stdin/stdout remain connected. The webhook port is separate from the MCP transport.

---

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# Type-check only (no build)
npm run typecheck

# Build
npm run build

# Lint
npm run lint
```

### Project structure

```
src/
├── index.ts              # Entry point — loads env, wires up components
├── server.ts             # MCP server — registers tools, handles requests
├── whatsapp/
│   ├── client.ts         # WhatsApp Cloud API client with retry logic
│   ├── types.ts          # TypeScript types and interfaces
│   └── webhook.ts        # Express webhook server + in-memory store
└── tools/
    ├── messages.ts       # Send/receive message tools
    ├── contacts.ts       # Contact and business profile tools
    ├── media.ts          # Media upload/download/delete tools
    └── templates.ts      # Template message tools
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting bugs, suggesting features, and submitting pull requests.

---

## License

[MIT](LICENSE) — Copyright (c) 2025 FredShred7
