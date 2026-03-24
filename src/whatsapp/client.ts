import axios, { AxiosInstance, AxiosError } from "axios";
import { createReadStream } from "fs";
import FormData from "form-data";
import type {
  WhatsAppConfig,
  OutgoingMessagePayload,
  SendMessageResponse,
  MediaUploadResponse,
  MediaUrlResponse,
  BusinessProfile,
  BusinessProfileResponse,
  PhoneNumbersResponse,
  MessageTemplatesResponse,
  InteractiveObject,
  TemplateObject,
  WhatsAppAPIError,
} from "./types.js";
import { WhatsAppError } from "./types.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export class WhatsAppClient {
  private readonly config: WhatsAppConfig;
  private readonly http: AxiosInstance;
  private readonly maxRetries: number;

  constructor(config: WhatsAppConfig, maxRetries = DEFAULT_MAX_RETRIES) {
    this.config = config;
    this.maxRetries = maxRetries;

    this.http = axios.create({
      baseURL: `${config.baseUrl}/${config.apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async request<T>(
    method: "get" | "post" | "delete",
    path: string,
    data?: unknown,
    attempt = 1,
  ): Promise<T> {
    try {
      const response = await this.http.request<T>({ method, url: path, data });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError<WhatsAppAPIError>;

      if (axiosErr.response) {
        const apiErr = axiosErr.response.data?.error;
        const statusCode = axiosErr.response.status;

        // Rate-limit: 429 or specific WhatsApp rate-limit codes
        if ((statusCode === 429 || apiErr?.code === 130429) && attempt <= this.maxRetries) {
          const delayMs = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delayMs);
          return this.request<T>(method, path, data, attempt + 1);
        }

        // Transient server errors
        if (statusCode >= 500 && attempt <= this.maxRetries) {
          const delayMs = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delayMs);
          return this.request<T>(method, path, data, attempt + 1);
        }

        throw new WhatsAppError(
          apiErr?.message ?? `WhatsApp API error (HTTP ${statusCode})`,
          apiErr?.code ?? statusCode,
          apiErr?.type ?? "unknown",
          apiErr?.fbtrace_id,
        );
      }

      // Network error — retry
      if (attempt <= this.maxRetries) {
        const delayMs = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delayMs);
        return this.request<T>(method, path, data, attempt + 1);
      }

      throw new WhatsAppError(
        `Network error communicating with WhatsApp API: ${(err as Error).message}`,
        0,
        "network_error",
      );
    }
  }

  private get phoneNumberPath(): string {
    return `/${this.config.phoneNumberId}`;
  }

  // ─── Send Messages ────────────────────────────────────────────────────────

  async sendTextMessage(
    to: string,
    text: string,
    previewUrl = false,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: previewUrl },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendVideoMessage(
    to: string,
    videoUrl: string,
    caption?: string,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "video",
      video: { link: videoUrl, caption },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendAudioMessage(
    to: string,
    audioUrl: string,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "audio",
      audio: { link: audioUrl },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    caption?: string,
    filename?: string,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: { link: documentUrl, caption, filename },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateObject["components"],
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendInteractiveMessage(
    to: string,
    interactive: InteractiveObject,
    replyToMessageId?: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive,
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async sendReaction(
    to: string,
    messageId: string,
    emoji: string,
  ): Promise<SendMessageResponse> {
    const payload: OutgoingMessagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    };
    return this.request<SendMessageResponse>("post", `${this.phoneNumberPath}/messages`, payload);
  }

  async markMessageAsRead(messageId: string): Promise<{ success: boolean }> {
    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };
    return this.request<{ success: boolean }>(
      "post",
      `${this.phoneNumberPath}/messages`,
      payload,
    );
  }

  // ─── Media ────────────────────────────────────────────────────────────────

  async getMediaUrl(mediaId: string): Promise<MediaUrlResponse> {
    return this.request<MediaUrlResponse>("get", `/${mediaId}`);
  }

  async uploadMedia(filePath: string, mimeType: string): Promise<MediaUploadResponse> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", createReadStream(filePath), { contentType: mimeType });

    try {
      const response = await this.http.post<MediaUploadResponse>(
        `${this.phoneNumberPath}/media`,
        form,
        { headers: form.getHeaders() },
      );
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError<WhatsAppAPIError>;
      if (axiosErr.response) {
        const apiErr = axiosErr.response.data?.error;
        throw new WhatsAppError(
          apiErr?.message ?? `Failed to upload media (HTTP ${axiosErr.response.status})`,
          apiErr?.code ?? axiosErr.response.status,
          apiErr?.type ?? "upload_error",
          apiErr?.fbtrace_id,
        );
      }
      throw new WhatsAppError(
        `Network error uploading media: ${(err as Error).message}`,
        0,
        "network_error",
      );
    }
  }

  async deleteMedia(mediaId: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>("delete", `/${mediaId}`);
  }

  // ─── Business Profile ─────────────────────────────────────────────────────

  async getBusinessProfile(): Promise<BusinessProfile> {
    const fields = "about,address,description,email,profile_picture_url,websites,vertical";
    const response = await this.request<BusinessProfileResponse>(
      "get",
      `${this.phoneNumberPath}/whatsapp_business_profile?fields=${fields}`,
    );
    return response.data[0] ?? {};
  }

  async updateBusinessProfile(profile: Partial<BusinessProfile>): Promise<{ success: boolean }> {
    const payload = { messaging_product: "whatsapp", ...profile };
    return this.request<{ success: boolean }>(
      "post",
      `${this.phoneNumberPath}/whatsapp_business_profile`,
      payload,
    );
  }

  // ─── Phone Numbers ────────────────────────────────────────────────────────

  async getPhoneNumbers(): Promise<PhoneNumbersResponse> {
    if (!this.config.businessAccountId) {
      throw new WhatsAppError(
        "WHATSAPP_BUSINESS_ACCOUNT_ID is required to list phone numbers. " +
          "Set this environment variable and restart the server.",
        400,
        "config_error",
      );
    }
    return this.request<PhoneNumbersResponse>(
      "get",
      `/${this.config.businessAccountId}/phone_numbers`,
    );
  }

  // ─── Contact Info ─────────────────────────────────────────────────────────

  async getContactInfo(phoneNumber: string): Promise<{
    input: string;
    wa_id: string;
    status: "valid" | "invalid";
  }> {
    const payload = {
      messaging_product: "whatsapp",
      contacts: [phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`],
    };
    const response = await this.request<{
      contacts: Array<{ input: string; wa_id: string; status: "valid" | "invalid" }>;
    }>("post", `${this.phoneNumberPath}/contacts`, payload);
    return (
      response.contacts[0] ?? {
        input: phoneNumber,
        wa_id: phoneNumber,
        status: "invalid" as const,
      }
    );
  }

  // ─── Message Templates ────────────────────────────────────────────────────

  async listMessageTemplates(limit = 20): Promise<MessageTemplatesResponse> {
    if (!this.config.businessAccountId) {
      throw new WhatsAppError(
        "WHATSAPP_BUSINESS_ACCOUNT_ID is required to list templates. " +
          "Set this environment variable and restart the server.",
        400,
        "config_error",
      );
    }
    return this.request<MessageTemplatesResponse>(
      "get",
      `/${this.config.businessAccountId}/message_templates?limit=${limit}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
