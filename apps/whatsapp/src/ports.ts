/**
 * The seams between this package and the rest of City Chauffeurs.
 *
 * This package knows how to talk on WhatsApp and how to hold a conversation.
 * It does not know where anything is stored, and it holds no business rules of
 * its own: every enquiry, booking and customer is created by the same server
 * code the website and the admin already use. That is what these interfaces
 * are for. `apps/server` implements them with its own repositories and hands
 * them in, so there is one set of rules for how a customer is matched or an
 * enquiry is numbered, whichever door the customer came through.
 *
 * Nothing here may import from `apps/server` or `packages/db`. Tests hand in
 * fakes; production hands in the real thing.
 */

// ---------------------------------------------------------------- identity

/** A telephone number in E.164 — `+447700900321`. Only `normalisePhone` makes one. */
export type E164 = string & { readonly __brand: "E164" };

// ---------------------------------------------------------------- conversation

/**
 * Who is answering.
 *
 * `ai_active` — the assistant replies.
 * `human_requested` — the customer asked for a person, or the assistant could
 *   not help; the assistant has said so once and now stays silent until a
 *   person picks the conversation up.
 * `human_active` — a person has taken over and is replying from the admin.
 * `closed` — finished. A new message from the same number opens a new one.
 *
 * The assistant replies only in `ai_active`. That is enforced where a turn
 * starts, not by asking the model to behave.
 */
export type ConversationStatus = "ai_active" | "human_requested" | "human_active" | "closed";

export const acceptsAssistantReplies = (status: ConversationStatus) => status === "ai_active";

/**
 * What the customer has told us about the journey, held as fields rather than
 * left in the transcript.
 *
 * The model fills it in through a tool as the conversation goes, the server
 * validates every value on the way in, and the enquiry or booking request is
 * built from this and nothing else — so what is recorded is what was
 * validated, not whatever the model happened to write at the end.
 */
export type JourneyDraft = {
  /** A service slug from the real catalogue. */
  service?: string;
  /** A vehicle id from the real, published fleet. */
  vehicleId?: string;
  pickup?: string;
  dropoff?: string;
  /** "YYYY-MM-DD" — a real day, not in the past. */
  date?: string;
  time?: string;
  passengers?: number;
  luggage?: string;
  flight?: string;
  notes?: string;
  /** The customer's own name, as they gave it. */
  name?: string;
  email?: string;
};

export type ConversationState = {
  journey: JourneyDraft;
  /** References already given in this conversation, so they are not given twice. */
  references: string[];
  /**
   * The last request recorded, and a fingerprint of the journey it was made
   * from. Asking again for the same journey returns the same reference
   * instead of a second enquiry the office would have to spot as a duplicate.
   */
  lastRequest?: { kind: "enquiry" | "booking"; fingerprint: string; reference: string };
  /**
   * When the last inbound message a finished turn answered was received (ISO).
   *
   * Recorded rather than inferred, because order of arrival and order of
   * replies part company: if a second message arrives while the first is
   * being answered, the reply to the first lands after the second — and
   * "has anything replied since?" would then leave the second unanswered.
   */
  answeredThrough?: string;
};

export const emptyState = (): ConversationState => ({ journey: {}, references: [] });

export type Conversation = {
  id: string;
  phone: E164;
  /** The customer on file, once one is known. */
  customerId: string | null;
  /** The name WhatsApp reports for the sender — a hint, never a record. */
  profileName: string | null;
  status: ConversationStatus;
  state: ConversationState;
  /** When the customer last wrote. WhatsApp only allows a free reply within 24 hours of it. */
  lastInboundAt: Date | null;
};

export type MessageDirection = "inbound" | "outbound";

export type StoredMessage = {
  id: string;
  direction: MessageDirection;
  /** A photo, voice note or location arrives as `unsupported`: recorded, not read. */
  kind: "text" | "unsupported";
  /** Who wrote an outbound message: the assistant, or a person in the office. */
  author: "customer" | "assistant" | "operator";
  body: string;
  createdAt: Date;
};

// ---------------------------------------------------------------- provider

/** A message that has arrived, in a shape that no longer says which provider brought it. */
export type InboundMessage = {
  provider: string;
  /** The provider's own id for the message. The idempotency key: a retry carries the same one. */
  providerMessageId: string;
  /** Our number it was sent to. Anything addressed elsewhere is not ours to answer. */
  to: E164;
  from: E164;
  profileName: string | null;
  /** Anything that is not text is recorded but not read. */
  kind: "text" | "unsupported";
  text: string;
  receivedAt: Date;
};

export type OutboundMessage = {
  to: E164;
  body: string;
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; retryable: boolean; code: string; detail: string };

/**
 * One WhatsApp provider. Translation and transport only: deduplication,
 * routing and deciding what to say all happen above it.
 */
export interface WhatsAppProvider {
  readonly name: string;
  /**
   * Throws `WebhookAuthenticationError` unless the request came from the
   * provider. `url` is the public address the provider called — behind a
   * proxy that is not the address the server sees, and a signature computed
   * over the wrong one never matches.
   */
  verifySignature(request: { url: string; body: string; headers: Headers }): void;
  /** Throws `WebhookPayloadError` for anything that is not a message this provider sends. */
  parseInbound(body: string): InboundMessage[];
  send(message: OutboundMessage): Promise<SendResult>;
  /**
   * What to answer the webhook with once a delivery is recorded. Twilio
   * reads the response as TwiML, so it gets an empty `<Response/>` — the
   * reply goes out separately through the API once the assistant has
   * something to say.
   */
  acknowledgement(): { contentType: string; body: string };
}

// ---------------------------------------------------------------- backend

/** The fleet as a customer may be told about it: published vehicles only. */
export type FleetVehicle = {
  id: string;
  slug: string;
  name: string;
  make: string;
  model: string;
  groupings: string[];
  shortDescription: string;
  /** `null` where the client has not confirmed it — say so rather than guess. */
  passengers: number | null;
  luggage: string;
  chauffeurOnly: boolean;
  /** The indicative rates the website itself publishes, or `null`. Never a quote. */
  hourlyRate: number | null;
  dayRate: number | null;
};

export type ServiceSummary = {
  slug: string;
  name: string;
  summary: string;
};

/**
 * Something the enquiry form offers that has no page behind it — self-drive
 * supercar hire, a chauffeur-driven supercar experience, "something else".
 *
 * The business takes these enquiries; it simply does not publish a service
 * page for them. Without this the assistant told customers a thing existed
 * only if it had a page, while the website's own form happily took it.
 */
export type EnquiryOption = {
  /** The value the enquiry records, e.g. "supercar-hire". */
  value: string;
  label: string;
};

export type ServiceDetail = ServiceSummary & {
  standfirst: string;
  benefits: { title: string; copy: string }[];
  /** What the office needs to quote, in the service's own words. */
  needs: string[];
  vehicleNames: string[];
};

export type RequestCustomer = {
  name: string;
  phone: E164;
  email: string;
};

/** A journey the application has already validated, ready to become a record. */
export type RequestJourney = {
  service: string;
  vehicleId: string | null;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  passengers: number | null;
  luggage: string;
  flight: string;
  notes: string;
};

export type CreatedRecord = { reference: string };

/**
 * A record the server refused. The fields are the server's own messages,
 * safe to pass on — they are the same ones the website form shows.
 */
export class BackendValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super("The request was not accepted.");
    this.name = "BackendValidationError";
  }
}

export type EnquiryStatusSummary = {
  reference: string;
  /** The status label the admin uses — "New", "Quoted", "Won". */
  status: string;
  createdAt: string;
};

/**
 * Where a booking stands, in the only terms that are honest: the office's own
 * label, and whether anybody has actually agreed to it yet.
 */
export type BookingStatusSummary = {
  reference: string;
  /** The status label the admin uses — "Requested", "Confirmed", "Completed". */
  status: string;
  /** False until a person in the office has confirmed it. */
  confirmed: boolean;
  date: string;
  time: string;
  pickup: string;
  dropoff: string;
  /** The vehicle on the booking, where one is assigned. */
  vehicle: string | null;
};

/**
 * Everything the assistant may ask City Chauffeurs to do.
 *
 * Deliberately narrow. The assistant can read what the website publishes, and
 * it can ask for things the website already lets a stranger ask for. It
 * cannot confirm, price, cancel or change anything, because nothing here lets
 * it.
 */
export interface Backend {
  listFleet(): Promise<FleetVehicle[]>;
  listServices(): Promise<ServiceSummary[]>;
  /** Everything the website's enquiry form offers, including what has no page. */
  listEnquiryOptions(): Promise<EnquiryOption[]>;
  getService(slug: string): Promise<ServiceDetail | null>;
  /**
   * `submissionId` is derived from the triggering WhatsApp message, so a
   * redelivered message finds the enquiry it already made rather than making
   * a second one.
   */
  createEnquiry(input: {
    customer: RequestCustomer;
    journey: RequestJourney;
    submissionId: string;
  }): Promise<CreatedRecord>;
  /** A booking *request*: pending until the office confirms it. Never a reservation. */
  createBookingRequest(input: {
    customer: RequestCustomer;
    journey: RequestJourney;
    submissionId: string;
  }): Promise<CreatedRecord>;
  /**
   * Only an enquiry belonging to this telephone number. Anybody else's
   * reference answers the same as one that does not exist.
   */
  findEnquiry(reference: string, phone: E164): Promise<EnquiryStatusSummary | null>;
  /** Where one of this customer's own bookings stands. Only theirs. */
  findBooking(reference: string, phone: E164): Promise<BookingStatusSummary | null>;
  /** The customer on file for this number, if there is one. */
  matchCustomer(phone: E164): Promise<{ id: string; name: string } | null>;
}

// ---------------------------------------------------------------- store

export type RecordedInbound =
  | {
      outcome: "recorded";
      conversation: Conversation;
      messageId: string;
      /** `null` when the conversation is with a person: nothing for the assistant to do. */
      runId: string | null;
    }
  /** Seen before. Nothing written, nothing queued, nothing sent. */
  | { outcome: "duplicate" };

/**
 * A reply that was written down but never got out — the process stopped
 * between recording it and the provider accepting it.
 */
export type UndeliveredMessage = {
  id: string;
  conversationId: string;
  to: E164;
  body: string;
};

/** What was left half-done when the process last stopped. */
export type InterruptedWork = {
  /** Runs that were being worked on, put back in the queue. */
  requeuedRuns: string[];
  /** Replies recorded but not sent, oldest first. */
  undelivered: UndeliveredMessage[];
};

export type ToolCallRecord = {
  name: string;
  ok: boolean;
  errorCode: string | null;
  durationMs: number;
};

export type TurnUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

/**
 * Where conversations are kept. The server implements this against Postgres;
 * nothing in this package touches a database.
 */
export interface ConversationStore {
  /**
   * Records one inbound message, idempotently. Finds or creates the number's
   * identity and its one open conversation, links the customer on file if
   * there is one, and queues an assistant run — unless the conversation is
   * with a person, in which case the message is kept for them and nothing is
   * queued.
   */
  recordInbound(message: InboundMessage, customerId: string | null): Promise<RecordedInbound>;
  /** Takes a queued run for processing. `null` if another worker took it, or it was never queued. */
  claimRun(runId: string): Promise<{ conversationId: string; triggeringMessageId: string } | null>;
  getConversation(conversationId: string): Promise<Conversation>;
  /** The most recent messages, oldest first. */
  history(conversationId: string, limit: number): Promise<StoredMessage[]>;
  /**
   * Writes the outcome of a turn in one go: the state, any change of status,
   * the reply to send, and the run's record. Returns the reply's id so its
   * delivery can be recorded against it, or `null` when there is no reply.
   */
  completeTurn(input: {
    runId: string;
    conversationId: string;
    state: ConversationState;
    status: ConversationStatus;
    customerId: string | null;
    handoff: { reason: string; summary: string } | null;
    reply: string | null;
    run: {
      outcome: "succeeded" | "skipped" | "failed";
      model: string | null;
      iterations: number;
      toolCalls: ToolCallRecord[];
      usage: TurnUsage | null;
      errorCode: string | null;
      durationMs: number;
    };
  }): Promise<{ replyMessageId: string | null }>;
  markDelivered(messageId: string, providerMessageId: string): Promise<void>;
  markUndelivered(messageId: string, code: string, detail: string): Promise<void>;
  /** Runs still queued, oldest first — for picking up after a restart. */
  queuedRuns(): Promise<string[]>;
  /**
   * Picks up what the last process was in the middle of: a run it had taken
   * goes back in the queue, and a reply it had written down but not sent is
   * handed back to be sent.
   *
   * Only safe because one process runs the channel. A second process would
   * find the first one's live work here and take it away mid-turn; before
   * there can be two, this has to become "mine, and older than a timeout".
   */
  recoverInterrupted(): Promise<InterruptedWork>;
  /** How many assistant runs this conversation has had since `since` — the ceiling on what one conversation may spend. */
  runsSince(conversationId: string, since: Date): Promise<number>;
  /**
   * A reply typed by a person in the office. Recorded before it is sent, so
   * the transcript shows what was said even if delivery fails.
   */
  recordOperatorMessage(conversationId: string, body: string): Promise<{ messageId: string }>;
  /** Moves a conversation between the assistant and a person, or closes it. */
  setStatus(conversationId: string, status: ConversationStatus): Promise<void>;
  /**
   * Queues an assistant run for one message the customer is still waiting on
   * — used when the office hands a conversation back to the assistant.
   *
   * `null` when there is nothing to do: a run for that message already
   * exists, whatever state it is in, or the conversation is not the
   * assistant's to answer. The unique triggering message is what makes it
   * safe to ask twice.
   */
  queueRun(conversationId: string, messageId: string): Promise<string | null>;
}

// ---------------------------------------------------------------- errors

/** The request did not come from the provider. Says nothing about which check failed. */
export class WebhookAuthenticationError extends Error {
  constructor() {
    super("Unauthorised.");
    this.name = "WebhookAuthenticationError";
  }
}

/** The request came from the provider but is not a shape we can read. */
export class WebhookPayloadError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "WebhookPayloadError";
  }
}
