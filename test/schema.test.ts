import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toInputSchema } from "../src/tools/shared.js";
import { messageTools } from "../src/tools/messages.js";
import { contactTools } from "../src/tools/contacts.js";
import { mediaTools } from "../src/tools/media.js";
import { templateTools } from "../src/tools/templates.js";

const allTools = [...messageTools, ...contactTools, ...mediaTools, ...templateTools];
const byName = Object.fromEntries(allTools.map((t) => [t.name, t.inputSchema as Record<string, any>]));

describe("toInputSchema", () => {
  it("preserves string min/max length constraints", () => {
    const schema = toInputSchema(
      z.object({ text: z.string().min(1).max(4096) }),
    ) as any;
    expect(schema.type).toBe("object");
    expect(schema.properties.text.minLength).toBe(1);
    expect(schema.properties.text.maxLength).toBe(4096);
  });

  it("preserves number min/max and default, and omits defaulted fields from required", () => {
    const schema = toInputSchema(
      z.object({ limit: z.number().int().min(1).max(50).optional().default(20) }),
    ) as any;
    expect(schema.properties.limit.type).toBe("integer");
    expect(schema.properties.limit.minimum).toBe(1);
    expect(schema.properties.limit.maximum).toBe(50);
    expect(schema.properties.limit.default).toBe(20);
    // A field with a default must not be required.
    expect(schema.required ?? []).not.toContain("limit");
  });

  it("preserves enum constraints", () => {
    const schema = toInputSchema(
      z.object({ vertical: z.enum(["AUTO", "BEAUTY", "RETAIL"]) }),
    ) as any;
    expect(schema.properties.vertical.enum).toEqual(["AUTO", "BEAUTY", "RETAIL"]);
  });

  it("preserves string format (email)", () => {
    const schema = toInputSchema(z.object({ email: z.string().email() })) as any;
    expect(schema.properties.email.format).toBe("email");
  });

  it("marks non-optional fields as required", () => {
    const schema = toInputSchema(
      z.object({ a: z.string(), b: z.string().optional() }),
    ) as any;
    expect(schema.required).toContain("a");
    expect(schema.required ?? []).not.toContain("b");
  });

  it("strips the $schema field", () => {
    const schema = toInputSchema(z.object({ a: z.string() })) as any;
    expect("$schema" in schema).toBe(false);
  });
});

describe("tool inputSchemas (real tools)", () => {
  it("registers 18 tools", () => {
    expect(allTools).toHaveLength(18);
  });

  it("every tool advertises an object schema", () => {
    for (const tool of allTools) {
      expect((tool.inputSchema as Record<string, any>).type).toBe("object");
    }
  });

  it("whatsapp_send_text keeps text length bounds and required fields", () => {
    const s = byName["whatsapp_send_text"];
    expect(s.properties.text.minLength).toBe(1);
    expect(s.properties.text.maxLength).toBe(4096);
    expect(s.required).toEqual(expect.arrayContaining(["to", "text"]));
  });

  it("whatsapp_list_conversations limit has default and is not required", () => {
    const s = byName["whatsapp_list_conversations"];
    expect(s.properties.limit.default).toBe(20);
    expect(s.required ?? []).not.toContain("limit");
  });

  it("whatsapp_update_business_profile keeps the vertical enum (19 values) and email format", () => {
    const s = byName["whatsapp_update_business_profile"];
    expect(s.properties.vertical.enum).toHaveLength(19);
    expect(s.properties.email.format).toBe("email");
  });

  it("whatsapp_send_template models its component union as anyOf", () => {
    const s = byName["whatsapp_send_template"];
    expect(s.properties.components.items.anyOf).toBeTypeOf("object");
  });
});
