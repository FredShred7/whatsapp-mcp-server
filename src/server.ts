import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { WhatsAppClient } from "./whatsapp/client.js";
import type { WhatsAppWebhook } from "./whatsapp/webhook.js";
import { messageTools } from "./tools/messages.js";
import { contactTools } from "./tools/contacts.js";
import { mediaTools } from "./tools/media.js";
import { templateTools } from "./tools/templates.js";
import type { ToolDefinition } from "./tools/messages.js";

const ALL_TOOLS: ToolDefinition[] = [
  ...messageTools,
  ...contactTools,
  ...mediaTools,
  ...templateTools,
];

export async function startMcpServer(
  client: WhatsAppClient,
  webhook?: WhatsAppWebhook,
): Promise<void> {
  const server = new Server(
    {
      name: "whatsapp-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ─── tools/list ────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: ALL_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // ─── tools/call ────────────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = ALL_TOOLS.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: "${name}". Use tools/list to see available tools.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(
        (args ?? {}) as Record<string, unknown>,
        client,
        webhook,
      );
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Unexpected error calling tool "${name}": ${String(err)}`;
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  // ─── Transport ─────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[mcp] WhatsApp MCP server started on stdio transport");
  console.error(`[mcp] ${ALL_TOOLS.length} tools registered`);
}
