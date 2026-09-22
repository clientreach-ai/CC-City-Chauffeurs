import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { customer } from "./operations";

/**
 * WhatsApp — the conversations the assistant and the office hold with
 * customers, and a record of every turn the assistant took.
 *
 * One business, so there is no tenant anywhere. The types of the status and
 * state columns are spelled out here rather than imported from
 * `@CC-City-Chauffeurs/whatsapp`, because the database package must not
 * depend on an application; the server maps between the two and the compiler
 * checks that they agree.
 *
 * Two indexes carry the rules, and both are partial, which drizzle can
 * describe but not always diff: one open conversation per number, and one row
 * per provider message. They are written out in the migration as well.
 */

type ConversationStatus = "ai_active" | "human_requested" | "human_active" | "closed";

/**
 * Opaque to the database: the channel owns its shape and it is only ever read
 * and written whole. The two fields every state has are named so a default
 * can be written; anything else the channel keeps (the last request it made,
 * say) rides along untouched.
 */
type ConversationStateDocument = {
  journey: Record<string, unknown>;
  references: string[];
  [field: string]: unknown;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

/**
 * A telephone number that has written to us. The number is the identity; the
 * customer is who we think it is.
 */
export const whatsappIdentity = pgTable("whatsapp_identity", {
  id: text("id").primaryKey(),
  /**
   * E.164, normalised before it is stored, so `07700 900321` and
   * `+447700900321` cannot become two people.
   */
  phoneE164: text("phone_e164").notNull().unique(),
  customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
  /** What WhatsApp says the sender calls themselves. A hint, never a record. */
  profileName: text("profile_name"),
  ...timestamps,
});

export const whatsappConversation = pgTable(
  "whatsapp_conversation",
  {
    id: text("id").primaryKey(),
    identityId: text("identity_id")
      .notNull()
      .references(() => whatsappIdentity.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    status: text("status").$type<ConversationStatus>().default("ai_active").notNull(),
    /** The journey as far as it has been told, and the references already given. Read and written whole. */
    state: jsonb("state")
      .$type<ConversationStateDocument>()
      .default({ journey: {}, references: [] })
      .notNull(),
    handoffReason: text("handoff_reason"),
    handoffSummary: text("handoff_summary"),
    /** WhatsApp allows a free reply only within 24 hours of this. */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    /**
     * One open conversation per number. A closed one is history; the next
     * message from the same number opens a new one rather than reviving it.
     */
    uniqueIndex("whatsapp_conversation_open_idx")
      .on(table.identityId)
      .where(sql`${table.status} <> 'closed'`),
    index("whatsapp_conversation_status_idx").on(table.status),
    index("whatsapp_conversation_last_message_idx").on(table.lastMessageAt),
  ],
);

export const whatsappMessage = pgTable(
  "whatsapp_message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => whatsappConversation.id, { onDelete: "cascade" }),
    direction: text("direction").$type<"inbound" | "outbound">().notNull(),
    author: text("author").$type<"customer" | "assistant" | "operator">().notNull(),
    /** Which provider carried it — "twilio", "simulator". Null for an outbound message not yet sent. */
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    kind: text("kind").$type<"text" | "unsupported">().default("text").notNull(),
    body: text("body").notNull(),
    delivery: text("delivery").$type<"received" | "pending" | "sent" | "failed">().notNull(),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    /**
     * The first idempotency layer. A provider that retries a webhook sends
     * the same message id, and this refuses the second row.
     */
    uniqueIndex("whatsapp_message_provider_idx")
      .on(table.provider, table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    index("whatsapp_message_conversation_idx").on(table.conversationId, table.createdAt),
    check("whatsapp_message_body_length", sql`char_length(${table.body}) <= 4096`),
  ],
);

export type WhatsAppToolCallRecord = {
  name: string;
  ok: boolean;
  errorCode: string | null;
  durationMs: number;
};

/**
 * One assistant turn. Tool names and outcomes are kept; their arguments are
 * not, because the arguments are the customer's name, number and journey.
 */
export const whatsappAgentRun = pgTable(
  "whatsapp_agent_run",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => whatsappConversation.id, { onDelete: "cascade" }),
    /** The second idempotency layer: one run per inbound message, ever. */
    triggeringMessageId: text("triggering_message_id")
      .notNull()
      .unique()
      .references(() => whatsappMessage.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"queued" | "running" | "succeeded" | "skipped" | "failed">()
      .default("queued")
      .notNull(),
    model: text("model"),
    iterations: integer("iterations"),
    toolCalls: jsonb("tool_calls").$type<WhatsAppToolCallRecord[]>(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    replyMessageId: text("reply_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("whatsapp_agent_run_status_idx").on(table.status, table.createdAt),
    index("whatsapp_agent_run_conversation_idx").on(table.conversationId),
  ],
);

// ---------------------------------------------------------------- relations

export const whatsappIdentityRelations = relations(whatsappIdentity, ({ one, many }) => ({
  customer: one(customer, { fields: [whatsappIdentity.customerId], references: [customer.id] }),
  conversations: many(whatsappConversation),
}));

export const whatsappConversationRelations = relations(whatsappConversation, ({ one, many }) => ({
  identity: one(whatsappIdentity, {
    fields: [whatsappConversation.identityId],
    references: [whatsappIdentity.id],
  }),
  customer: one(customer, { fields: [whatsappConversation.customerId], references: [customer.id] }),
  messages: many(whatsappMessage),
  runs: many(whatsappAgentRun),
}));

export const whatsappMessageRelations = relations(whatsappMessage, ({ one }) => ({
  conversation: one(whatsappConversation, {
    fields: [whatsappMessage.conversationId],
    references: [whatsappConversation.id],
  }),
}));

export const whatsappAgentRunRelations = relations(whatsappAgentRun, ({ one }) => ({
  conversation: one(whatsappConversation, {
    fields: [whatsappAgentRun.conversationId],
    references: [whatsappConversation.id],
  }),
  triggeringMessage: one(whatsappMessage, {
    fields: [whatsappAgentRun.triggeringMessageId],
    references: [whatsappMessage.id],
  }),
}));
