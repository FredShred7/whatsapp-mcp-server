import { EventEmitter } from "events";
import { createHmac, timingSafeEqual } from "crypto";
import express, { Request, Response, Application } from "express";
import type {
  WebhookPayload,
  IncomingMessage,
  MessageStatusUpdate,
  StoredMessage,
  Conversation,
} from "./types.js";
import { MessageStatus } from "./types.js";

export interface WebhookConfig {
  verifyToken: string;
  port: number;
  path: string;
  maxMessagesPerConversation?: number;
  /** Meta App Secret. When set, the X-Hub-Signature-256 header is verified. */
  appSecret?: string;
}

/** Express Request augmented with the raw request body captured for HMAC verification. */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export class WhatsAppWebhook extends EventEmitter {
  private readonly config: WebhookConfig;
  private readonly app: Application;
  private readonly conversations: Map<string, Conversation> = new Map();
  private readonly messageStatuses: Map<string, MessageStatus> = new Map();
  private readonly maxMessages: number;

  constructor(config: WebhookConfig) {
    super();
    this.config = config;
    this.maxMessages = config.maxMessagesPerConversation ?? 100;
    this.app = express();
    // Capture the raw body so we can verify the X-Hub-Signature-256 HMAC.
    this.app.use(
      express.json({
        verify: (req, _res, buf) => {
          (req as RawBodyRequest).rawBody = buf;
        },
      }),
    );
    this.registerRoutes();

    if (!config.appSecret) {
      console.error(
        "[webhook] WARNING: WHATSAPP_APP_SECRET is not set — incoming webhook " +
          "signatures will NOT be verified. This is fine for local development, " +
          "but you should set WHATSAPP_APP_SECRET in production.",
      );
    }
  }

  // ─── Signature Verification ───────────────────────────────────────────────

  /**
   * Verify the X-Hub-Signature-256 header against the raw request body using
   * HMAC-SHA256 keyed with the Meta App Secret. Returns true when verification
   * passes, or when no app secret is configured (dev mode).
   */
  private verifySignature(req: Request): boolean {
    if (!this.config.appSecret) {
      // No secret configured — skip verification (warned at startup).
      return true;
    }

    const header = req.get("x-hub-signature-256");
    if (!header) {
      console.error("[webhook] Rejected request: missing X-Hub-Signature-256 header");
      return false;
    }

    const rawBody = (req as RawBodyRequest).rawBody;
    if (!rawBody) {
      console.error("[webhook] Rejected request: raw body unavailable for verification");
      return false;
    }

    const expected =
      "sha256=" + createHmac("sha256", this.config.appSecret).update(rawBody).digest("hex");

    const headerBuf = Buffer.from(header);
    const expectedBuf = Buffer.from(expected);
    if (headerBuf.length !== expectedBuf.length) {
      console.error("[webhook] Rejected request: signature mismatch");
      return false;
    }

    const ok = timingSafeEqual(headerBuf, expectedBuf);
    if (!ok) {
      console.error("[webhook] Rejected request: signature mismatch");
    }
    return ok;
  }

  // ─── Route Registration ───────────────────────────────────────────────────

  private registerRoutes(): void {
    this.app.get(this.config.path, this.handleVerification.bind(this));
    this.app.post(this.config.path, this.handleIncoming.bind(this));
  }

  // ─── GET /webhook — Meta verification challenge ───────────────────────────

  private handleVerification(req: Request, res: Response): void {
    const mode = req.query["hub.mode"] as string | undefined;
    const token = req.query["hub.verify_token"] as string | undefined;
    const challenge = req.query["hub.challenge"] as string | undefined;

    if (mode === "subscribe" && token === this.config.verifyToken) {
      console.error(`[webhook] Verification successful`);
      res.status(200).send(challenge);
    } else {
      console.error(`[webhook] Verification failed — token mismatch or wrong mode`);
      res.sendStatus(403);
    }
  }

  // ─── POST /webhook — incoming events ─────────────────────────────────────

  private handleIncoming(req: Request, res: Response): void {
    // Verify the payload signature before doing anything else.
    if (!this.verifySignature(req)) {
      res.sendStatus(403);
      return;
    }

    // Respond 200 immediately so Meta doesn't retry
    res.sendStatus(200);

    const payload = req.body as WebhookPayload;

    if (payload?.object !== "whatsapp_business_account") {
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;

        const value = change.value;

        // Process incoming messages
        for (const message of value.messages ?? []) {
          const contact = value.contacts?.find((c) => c.wa_id === message.from);
          this.processIncomingMessage(message, contact?.profile?.name);
        }

        // Process status updates
        for (const status of value.statuses ?? []) {
          this.processStatusUpdate(status);
        }
      }
    }
  }

  // ─── Message Processing ───────────────────────────────────────────────────

  private processIncomingMessage(message: IncomingMessage, displayName?: string): void {
    const phoneNumber = message.from;
    const content = this.extractTextContent(message);

    const stored: StoredMessage = {
      id: message.id,
      direction: "inbound",
      from: phoneNumber,
      timestamp: new Date(Number(message.timestamp) * 1000),
      type: message.type,
      content,
      rawMessage: message,
    };

    this.addToConversation(phoneNumber, stored, displayName);
    this.emit("message", stored, message);
    console.error(`[webhook] Received ${message.type} from ${phoneNumber}: ${content}`);
  }

  private processStatusUpdate(status: MessageStatusUpdate): void {
    const mappedStatus =
      status.status === "sent"
        ? MessageStatus.Sent
        : status.status === "delivered"
          ? MessageStatus.Delivered
          : status.status === "read"
            ? MessageStatus.Read
            : MessageStatus.Failed;

    this.messageStatuses.set(status.id, mappedStatus);
    this.emit("status", status);
    console.error(
      `[webhook] Message ${status.id} status: ${status.status} (to ${status.recipient_id})`,
    );
  }

  private extractTextContent(message: IncomingMessage): string {
    switch (message.type) {
      case "text":
        return message.text?.body ?? "";
      case "image":
        return message.image?.caption ?? `[image: ${message.image?.id ?? "unknown"}]`;
      case "video":
        return message.video?.caption ?? `[video: ${message.video?.id ?? "unknown"}]`;
      case "audio":
        return `[audio: ${message.audio?.id ?? "unknown"}]`;
      case "document":
        return (
          message.document?.caption ??
          `[document: ${message.document?.filename ?? message.document?.id ?? "unknown"}]`
        );
      case "sticker":
        return `[sticker: ${message.sticker?.id ?? "unknown"}]`;
      case "location":
        return `[location: ${message.location?.name ?? `${message.location?.latitude},${message.location?.longitude}`}]`;
      case "reaction":
        return `[reaction: ${message.reaction?.emoji ?? ""} on ${message.reaction?.message_id ?? "unknown"}]`;
      case "interactive":
        return (
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "[interactive response]"
        );
      default:
        return `[${message.type}]`;
    }
  }

  // ─── Conversation Storage ─────────────────────────────────────────────────

  private addToConversation(
    phoneNumber: string,
    message: StoredMessage,
    displayName?: string,
  ): void {
    let conversation = this.conversations.get(phoneNumber);

    if (!conversation) {
      conversation = {
        phoneNumber,
        displayName,
        messages: [],
        lastActivity: new Date(),
      };
      this.conversations.set(phoneNumber, conversation);
    }

    if (displayName) conversation.displayName = displayName;
    conversation.lastActivity = new Date();
    conversation.messages.push(message);

    // Trim to max length
    if (conversation.messages.length > this.maxMessages) {
      conversation.messages = conversation.messages.slice(-this.maxMessages);
    }
  }

  // ─── Public Read API ──────────────────────────────────────────────────────

  addOutboundMessage(to: string, messageId: string, type: string, content: string): void {
    const stored: StoredMessage = {
      id: messageId,
      direction: "outbound",
      from: "me",
      to,
      timestamp: new Date(),
      type: type as StoredMessage["type"],
      content,
      status: MessageStatus.Sent,
    };
    this.addToConversation(to, stored);
    this.messageStatuses.set(messageId, MessageStatus.Sent);
  }

  getConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );
  }

  getConversation(phoneNumber: string): Conversation | undefined {
    return this.conversations.get(phoneNumber);
  }

  getMessageStatus(messageId: string): MessageStatus | undefined {
    return this.messageStatuses.get(messageId);
  }

  // ─── Server Lifecycle ─────────────────────────────────────────────────────

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.error(
          `[webhook] Listening on port ${this.config.port} at path ${this.config.path}`,
        );
        resolve();
      });
    });
  }
}
