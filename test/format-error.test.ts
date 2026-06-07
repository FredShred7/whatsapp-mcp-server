import { describe, it, expect } from "vitest";
import { z } from "zod";
import { formatError } from "../src/tools/shared.js";
import { WhatsAppError } from "../src/whatsapp/types.js";

describe("formatError", () => {
  it("formats a WhatsAppError with code and message", () => {
    const err = new WhatsAppError("Invalid token", 190, "OAuthException");
    expect(formatError(err)).toBe("WhatsApp API error (code 190): Invalid token");
  });

  it("includes the fbtrace_id when present", () => {
    const err = new WhatsAppError("Rate limited", 130429, "RateLimit", "trace_xyz");
    expect(formatError(err)).toBe(
      "WhatsApp API error (code 130429): Rate limited [trace: trace_xyz]",
    );
  });

  it("formats a ZodError as an Invalid input message listing issues", () => {
    const schema = z.object({ to: z.string().min(7), text: z.string().min(1) });
    const result = schema.safeParse({ to: "x", text: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const out = formatError(result.error);
      expect(out.startsWith("Invalid input:")).toBe(true);
      expect(out).toContain("to:");
      expect(out).toContain("text:");
    }
  });

  it("formats a generic Error using its message", () => {
    expect(formatError(new Error("boom"))).toBe("Unexpected error: boom");
  });

  it("falls back to String() for non-Error values", () => {
    expect(formatError("just a string")).toBe("Unexpected error: just a string");
  });
});
