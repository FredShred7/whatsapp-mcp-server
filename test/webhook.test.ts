import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";
import { WhatsAppWebhook, type WebhookConfig } from "../src/whatsapp/webhook.js";

// The webhook module does not use axios, but mock it defensively so a test can
// never accidentally reach the network.
vi.mock("axios");

const APP_SECRET = "test_app_secret";

function makeWebhook(overrides: Partial<WebhookConfig> = {}): WhatsAppWebhook {
  return new WhatsAppWebhook({
    verifyToken: "verify_me",
    port: 0,
    path: "/webhook",
    appSecret: APP_SECRET,
    ...overrides,
  });
}

// Build a minimal fake Express request carrying a captured raw body + header.
function makeReq(rawBody: Buffer | undefined, signature?: string) {
  return {
    get: (name: string) =>
      name.toLowerCase() === "x-hub-signature-256" ? signature : undefined,
    rawBody,
  };
}

function sign(body: Buffer, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("webhook signature verification", () => {
  const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));

  it("accepts a request with a valid signature", () => {
    const wh = makeWebhook();
    const req = makeReq(body, sign(body, APP_SECRET));
    expect((wh as any).verifySignature(req)).toBe(true);
  });

  it("rejects a request with an invalid signature", () => {
    const wh = makeWebhook();
    const req = makeReq(body, sign(body, "wrong_secret"));
    expect((wh as any).verifySignature(req)).toBe(false);
  });

  it("rejects a request with a missing signature header", () => {
    const wh = makeWebhook();
    const req = makeReq(body, undefined);
    expect((wh as any).verifySignature(req)).toBe(false);
  });

  it("rejects a request when the raw body is unavailable", () => {
    const wh = makeWebhook();
    const req = makeReq(undefined, sign(body, APP_SECRET));
    expect((wh as any).verifySignature(req)).toBe(false);
  });

  it("skips verification (returns true) when no app secret is configured", () => {
    const wh = makeWebhook({ appSecret: undefined });
    // No header at all — would normally fail, but dev mode skips it.
    const req = makeReq(body, undefined);
    expect((wh as any).verifySignature(req)).toBe(true);
  });
});

describe("webhook text extraction", () => {
  const wh = makeWebhook();
  const extract = (message: unknown) => (wh as any).extractTextContent(message);

  it("extracts the body of a text message", () => {
    expect(extract({ type: "text", text: { body: "hello world" } })).toBe("hello world");
  });

  it("uses the caption for an image, or a placeholder when absent", () => {
    expect(extract({ type: "image", image: { id: "m1", caption: "a cat" } })).toBe("a cat");
    expect(extract({ type: "image", image: { id: "m2" } })).toBe("[image: m2]");
  });

  it("placeholders audio with its media id", () => {
    expect(extract({ type: "audio", audio: { id: "aud_1" } })).toBe("[audio: aud_1]");
  });

  it("uses the document filename when there is no caption", () => {
    expect(extract({ type: "document", document: { id: "d1", filename: "report.pdf" } })).toBe(
      "[document: report.pdf]",
    );
  });

  it("extracts an interactive button reply title", () => {
    expect(
      extract({
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "b1", title: "Yes" } },
      }),
    ).toBe("Yes");
  });

  it("describes a reaction with emoji and target", () => {
    expect(
      extract({ type: "reaction", reaction: { emoji: "👍", message_id: "wamid.123" } }),
    ).toBe("[reaction: 👍 on wamid.123]");
  });

  it("uses a location name when present", () => {
    expect(
      extract({ type: "location", location: { latitude: 1, longitude: 2, name: "Office" } }),
    ).toBe("[location: Office]");
  });

  it("falls back to the bracketed type for unhandled message types", () => {
    expect(extract({ type: "order" })).toBe("[order]");
  });
});
