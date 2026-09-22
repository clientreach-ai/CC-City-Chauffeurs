import { api } from "./client";

/**
 * WhatsApp conversations — the office's side of the assistant.
 *
 * The types mirror what `/api/admin/whatsapp` returns rather than importing
 * them from the server, the same way the dashboard's overview does.
 *
 * None of these routes exist when WhatsApp is switched off: the server does
 * not mount them, so every call here comes back 404 and the client turns it
 * into a `CmsNotFoundError`. The screens read that as "not configured" and
 * say so, rather than showing a failure.
 */

export type ConversationStatus = "ai_active" | "human_requested" | "human_active" | "closed";

/** Ordered by what needs the office first — the list and the badge follow it. */
export const conversationStatuses: readonly { value: ConversationStatus; label: string; note: string }[] = [
  { value: "human_requested", label: "Needs a person", note: "Handed over — nobody has replied yet" },
  { value: "human_active", label: "With the office", note: "A person is answering; the assistant is silent" },
  { value: "ai_active", label: "Assistant", note: "The assistant is answering" },
  { value: "closed", label: "Closed", note: "Finished — a new message starts a new conversation" },
];

/** The reasons the assistant hands over. Anything else is shown as it came. */
export const handoffReasons: readonly { value: string; label: string }[] = [
  { value: "customer_asked", label: "Asked for a person" },
  { value: "complaint", label: "Complaint" },
  { value: "urgent", label: "Urgent" },
  { value: "existing_booking", label: "Existing booking" },
  { value: "cannot_help", label: "Assistant could not help" },
  { value: "other", label: "Other" },
];

export type ConversationSummary = {
  id: string;
  phone: string;
  profileName: string | null;
  customer: { id: string; name: string } | null;
  status: ConversationStatus;
  handoffReason: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  author: "customer" | "assistant" | "operator";
  /** A photograph, voice note or location arrives as `unsupported`. */
  kind: "text" | "unsupported";
  body: string;
  delivery: "received" | "pending" | "sent" | "failed";
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type ConversationDetail = ConversationSummary & {
  handoffSummary: string | null;
  lastInboundAt: string | null;
  createdAt: string;
  messages: ConversationMessage[];
};

/**
 * A reply is recorded before it is sent, so a refusal is an answer and not
 * an error: the message is in the transcript either way.
 */
export type SendResult =
  | { sent: true }
  | { sent: false; code: string; retryable: boolean; detail: string };

/** WhatsApp's own rule: a free-form reply only within 24 hours of the customer. */
export const SERVICE_WINDOW_HOURS = 24;

const sendFailures: Record<string, string> = {
  outside_service_window:
    "WhatsApp only allows a reply within 24 hours of the customer's last message. Ring or email them instead — the message has not been sent.",
  conversation_closed:
    "This conversation is closed. A new message from the customer opens a new one.",
};

/** Why a reply was not sent, worded for the office. */
export function sendFailureMessage(failure: Extract<SendResult, { sent: false }>) {
  const known = sendFailures[failure.code];
  if (known) return known;
  const detail = failure.detail || "WhatsApp refused the message.";
  return failure.retryable ? `${detail} Try again in a moment.` : detail;
}

export async function getConversations(status?: ConversationStatus) {
  const query = status ? `?${new URLSearchParams({ status }).toString()}` : "";
  return api.get<ConversationSummary[]>(`/whatsapp/conversations${query}`);
}

export async function getConversation(id: string) {
  return api.get<ConversationDetail>(`/whatsapp/conversations/${id}`);
}

/** Sends a reply as the office. `sent: false` means recorded but not delivered. */
export async function sendReply(id: string, body: string) {
  return api.post<SendResult>(`/whatsapp/conversations/${id}/messages`, { body });
}

export async function updateConversationStatus(id: string, status: ConversationStatus) {
  return api.patch<ConversationDetail>(`/whatsapp/conversations/${id}/status`, { status });
}
