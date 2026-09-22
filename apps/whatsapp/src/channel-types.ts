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

export type ChannelDependencies = {
  provider: WhatsAppProvider;
  store: ConversationStore;
  backend: Backend;
  model: ChatModel;
  config: ChannelConfig;
  log?: ChannelLogger;
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
  setStatus(conversationId: string, status: ConversationStatus): Promise<void>;
}
