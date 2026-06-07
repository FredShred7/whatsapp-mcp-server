import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { WhatsAppError } from "../whatsapp/types.js";

/**
 * Format any error thrown by a tool handler into a human-readable string.
 * Single source of truth shared by all tool modules.
 */
export function formatError(err: unknown): string {
  if (err instanceof WhatsAppError) {
    return `WhatsApp API error (code ${err.code}): ${err.message}${err.fbtrace_id ? ` [trace: ${err.fbtrace_id}]` : ""}`;
  }
  if (err instanceof z.ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return `Invalid input: ${issues}`;
  }
  return `Unexpected error: ${(err as Error)?.message ?? String(err)}`;
}

/**
 * Convert a Zod schema into a JSON Schema suitable for an MCP tool's
 * `inputSchema`. Using zod-to-json-schema keeps the Zod schema as the single
 * source of truth so constraints (min/max/enum/default/format) survive into
 * the schema advertised to MCP clients.
 */
export function toInputSchema(schema: z.ZodType): object {
  const json = zodToJsonSchema(schema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  // zod-to-json-schema adds a "$schema" field; strip it for a clean inputSchema.
  delete json["$schema"];
  return json;
}
