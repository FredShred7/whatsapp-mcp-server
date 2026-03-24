// ─── Configuration ───────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  businessAccountId?: string;
  apiVersion: string;
  baseUrl: string;
}

// ─── Message Status ───────────────────────────────────────────────────────────

export enum MessageStatus {
  Sent = "sent",
  Delivered = "delivered",
  Read = "read",
  Failed = "failed",
}

// ─── Outgoing Message Types ───────────────────────────────────────────────────

export interface TextObject {
  body: string;
  preview_url?: boolean;
}

export interface MediaObject {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

export interface LocationObject {
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export interface ContactObject {
  addresses?: ContactAddress[];
  birthday?: string;
  emails?: ContactEmail[];
  name: ContactName;
  org?: ContactOrg;
  phones?: ContactPhone[];
  urls?: ContactUrl[];
}

export interface ContactAddress {
  city?: string;
  country?: string;
  country_code?: string;
  state?: string;
  street?: string;
  type?: "HOME" | "WORK";
  zip?: string;
}

export interface ContactEmail {
  email?: string;
  type?: "HOME" | "WORK";
}

export interface ContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  prefix?: string;
}

export interface ContactOrg {
  company?: string;
  department?: string;
  title?: string;
}

export interface ContactPhone {
  phone?: string;
  type?: "CELL" | "MAIN" | "IPHONE" | "HOME" | "WORK";
  wa_id?: string;
}

export interface ContactUrl {
  url?: string;
  type?: "HOME" | "WORK";
}

export interface ReactionObject {
  message_id: string;
  emoji: string;
}

// ─── Template Message Types ───────────────────────────────────────────────────

export interface TemplateObject {
  name: string;
  language: TemplateLanguage;
  components?: TemplateComponent[];
}

export interface TemplateLanguage {
  code: string;
  policy?: "deterministic";
}

export type TemplateComponent =
  | TemplateHeaderComponent
  | TemplateBodyComponent
  | TemplateButtonComponent;

export interface TemplateHeaderComponent {
  type: "header";
  parameters: TemplateParameter[];
}

export interface TemplateBodyComponent {
  type: "body";
  parameters: TemplateParameter[];
}

export interface TemplateButtonComponent {
  type: "button";
  sub_type: "quick_reply" | "url" | "call_to_action";
  index: number;
  parameters: TemplateButtonParameter[];
}

export type TemplateParameter =
  | { type: "text"; text: string }
  | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | { type: "image"; image: MediaObject }
  | { type: "document"; document: MediaObject }
  | { type: "video"; video: MediaObject };

export type TemplateButtonParameter =
  | { type: "payload"; payload: string }
  | { type: "text"; text: string };

// ─── Interactive Message Types ────────────────────────────────────────────────

export type InteractiveObject =
  | InteractiveListMessage
  | InteractiveButtonMessage
  | InteractiveProductMessage
  | InteractiveProductListMessage;

export interface InteractiveListMessage {
  type: "list";
  header?: InteractiveHeader;
  body: InteractiveBody;
  footer?: InteractiveFooter;
  action: InteractiveListAction;
}

export interface InteractiveButtonMessage {
  type: "button";
  header?: InteractiveHeader;
  body: InteractiveBody;
  footer?: InteractiveFooter;
  action: InteractiveButtonAction;
}

export interface InteractiveProductMessage {
  type: "product";
  body?: InteractiveBody;
  footer?: InteractiveFooter;
  action: InteractiveProductAction;
}

export interface InteractiveProductListMessage {
  type: "product_list";
  header: InteractiveHeader;
  body: InteractiveBody;
  footer?: InteractiveFooter;
  action: InteractiveProductListAction;
}

export interface InteractiveHeader {
  type: "text" | "image" | "video" | "document";
  text?: string;
  image?: MediaObject;
  video?: MediaObject;
  document?: MediaObject;
}

export interface InteractiveBody {
  text: string;
}

export interface InteractiveFooter {
  text: string;
}

export interface InteractiveListAction {
  button: string;
  sections: InteractiveSection[];
}

export interface InteractiveButtonAction {
  buttons: InteractiveButton[];
}

export interface InteractiveProductAction {
  catalog_id: string;
  product_retailer_id: string;
}

export interface InteractiveProductListAction {
  catalog_id: string;
  sections: InteractiveProductSection[];
}

export interface InteractiveSection {
  title?: string;
  rows: InteractiveSectionRow[];
}

export interface InteractiveSectionRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveButton {
  type: "reply";
  reply: { id: string; title: string };
}

export interface InteractiveProductSection {
  title?: string;
  product_items: { product_retailer_id: string }[];
}

// ─── Outgoing API Payload ─────────────────────────────────────────────────────

export interface OutgoingMessagePayload {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: MessageType;
  text?: TextObject;
  image?: MediaObject;
  video?: MediaObject;
  audio?: MediaObject;
  document?: MediaObject;
  location?: LocationObject;
  contacts?: ContactObject[];
  reaction?: ReactionObject;
  template?: TemplateObject;
  interactive?: InteractiveObject;
  context?: { message_id: string };
}

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "contacts"
  | "reaction"
  | "template"
  | "interactive";

// ─── API Response Types ───────────────────────────────────────────────────────

export interface SendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface MediaUploadResponse {
  id: string;
}

export interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  messaging_product: "whatsapp";
}

export interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?:
    | "UNDEFINED"
    | "OTHER"
    | "AUTO"
    | "BEAUTY"
    | "APPAREL"
    | "EDU"
    | "ENTERTAIN"
    | "EVENT_PLAN"
    | "FINANCE"
    | "GROCERY"
    | "GOVT"
    | "HOTEL"
    | "HEALTH"
    | "NONPROFIT"
    | "PROF_SERVICES"
    | "RETAIL"
    | "TRAVEL"
    | "RESTAURANT"
    | "NOT_A_BIZ";
}

export interface BusinessProfileResponse {
  data: BusinessProfile[];
}

export interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
  code_verification_status?: string;
  is_official_business_account?: boolean;
}

export interface PhoneNumbersResponse {
  data: PhoneNumber[];
  paging?: {
    cursors: { before: string; after: string };
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: TemplateComponentDefinition[];
}

export interface TemplateComponentDefinition {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: TemplateButtonDefinition[];
}

export interface TemplateButtonDefinition {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface MessageTemplatesResponse {
  data: MessageTemplate[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

// ─── Webhook / Incoming Message Types ────────────────────────────────────────

export interface WebhookPayload {
  object: "whatsapp_business_account";
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: "whatsapp";
  metadata: WebhookMetadata;
  contacts?: WebhookContact[];
  messages?: IncomingMessage[];
  statuses?: MessageStatusUpdate[];
  errors?: WebhookError[];
}

export interface WebhookMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface IncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: IncomingMessageType;
  text?: { body: string };
  image?: IncomingMedia;
  video?: IncomingMedia;
  audio?: IncomingMedia;
  document?: IncomingMedia & { filename?: string };
  sticker?: IncomingMedia;
  location?: LocationObject & { name?: string; address?: string };
  contacts?: ContactObject[];
  reaction?: { message_id: string; emoji: string };
  interactive?: {
    type: "button_reply" | "list_reply" | "nfm_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  referral?: {
    source_url: string;
    source_type: string;
    source_id: string;
    headline: string;
    body: string;
    ctwa_clid: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
  };
  context?: {
    forwarded?: boolean;
    frequently_forwarded?: boolean;
    from?: string;
    id?: string;
  };
}

export type IncomingMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "reaction"
  | "interactive"
  | "button"
  | "order"
  | "system"
  | "unknown";

export interface IncomingMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface MessageStatusUpdate {
  id: string;
  recipient_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin: { type: string };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WebhookError[];
}

export interface WebhookError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

// ─── Internal Storage Types ───────────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to?: string;
  timestamp: Date;
  type: IncomingMessageType | MessageType;
  content: string;
  status?: MessageStatus;
  rawMessage?: IncomingMessage;
}

export interface Conversation {
  phoneNumber: string;
  displayName?: string;
  messages: StoredMessage[];
  lastActivity: Date;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { messaging_product: string; details: string };
  };
}

export class WhatsAppError extends Error {
  code: number;
  type: string;
  fbtrace_id?: string;

  constructor(message: string, code: number, type: string, fbtrace_id?: string) {
    super(message);
    this.name = "WhatsAppError";
    this.code = code;
    this.type = type;
    this.fbtrace_id = fbtrace_id;
  }
}
