/**
 * What the server sees of the WhatsApp channel.
 *
 * Two halves, deliberately separate. `ingest` is what runs inside Twilio's
 * request: check it is really Twilio, record the message, queue a run, and
 * answer — nothing slow, because Twilio gives up after fifteen seconds and a
 * model turn can take longer. `processRun` does the slow part afterwards: it
 * runs the assistant, stores the outcome and sends the reply. The server
 * schedules one after the other; a test can call them one at a time and see
 * each land.
 */

import type { ChatModel } from "./agent/model";
import type { Backend, ConversationStatus, ConversationStore, E164, SendResult, WhatsAppProvider } from "./ports";

export type ChannelConfig = {
  /**
   * The exact public address the provider posts to, including the path. The
   * signature is computed over it, so behind a reverse proxy this must be the
   * address the provider was given, not the one the server hears.
   */
  webhookUrl: string;
  /** Our WhatsApp number. A message addressed to any other number is ignored. */
  ourNumber: E164;
  /** How many earlier messages the model is shown. */
  historyLimit?: number;
  /** Most tool rounds in one reply before the assistant hands over. */
  maxIterations?: number;
  /**
   * The most assistant turns one conversation may have in a rolling hour.
   * Past it the assistant stands down and a person takes over, so a
   * conversation that has gone wrong cannot spend without end.
   */
  maxTurnsPerHour?: number;
  /** Largest webhook body accepted, in bytes. */
  maxBodyBytes?: number;
  /** Today's date, as the business sees it — injectable so tests do not depend on the clock. */
  today?: () => string;
};

export type ChannelLogger = {
  info(event: string, fields: Record<string, unknown>): void;
  warn(event: string, fields: Record<string, unknown>): void;
  error(event: string, fields: Record<string, unknown>): void;
};

/**
 * Somebody outside the conversation who needs to know.
 *
 * The assistant tells a customer that a member of the team will reply here,
 * which is a promise the office cannot keep if nobody tells them. The
 * channel has no idea how a business is reached — that is the server's
 * business — so it says what happened and leaves the telling to whoever
 * implements this.
 */
export type ChannelAnnouncements = {
  /** A conversation has stopped being the assistant's and is waiting for a person. */
  needsAPerson(waiting: {
    conversationId: string;
    phone: string;
    /** The name on file, where the customer is known to the business. */
    customerName: string | null;
    /** What WhatsApp calls them, which is only ever a hint. */
    profileName: string | null;
    reason: string;
    summary: string;
    /** The last thing the customer said, which is usually the whole story. */
    lastMessage: string;
  }): void;
};

export type ChannelDependencies = {
  provider: WhatsAppProvider;
  store: ConversationStore;
  backend: Backend;
  model: ChatModel;
  config: ChannelConfig;
  log?: ChannelLogger;
  /** Left out, a handover is recorded and nobody is told. */
  announce?: ChannelAnnouncements;
};

export type IngestResult = {
  status: number;
  contentType: string;
  body: string;
  /** Runs queued by this delivery. The caller processes them after answering. */
  runIds: string[];
};

export interface WhatsAppChannel {
  ingest(request: { body: string; headers: Headers }): Promise<IngestResult>;
  processRun(runId: string): Promise<void>;
  /** Picks up anything queued before a restart. */
  resumeQueued(): Promise<void>;
  /** A person in the office replying from the admin. */
  sendOperatorMessage(conversationId: string, body: string): Promise<SendResult>;
  /**
   * Moves a conversation between the assistant and a person, or closes it.
   * Handing one back to the assistant returns the run queued for whatever
   * the customer is still waiting on, for the caller to process after it has
   * answered — the same way the webhook does.
   */
  setStatus(conversationId: string, status: ConversationStatus): Promise<{ runIds: string[] }>;
}
