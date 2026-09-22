import { CmsNotFoundError } from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import type {
  Conversation,
  ConversationState,
  ConversationStatus,
  ConversationStore,
  E164,
  InboundMessage,
  InterruptedWork,
  RecordedInbound,
  StoredMessage,
} from "@CC-City-Chauffeurs/whatsapp/ports";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { newId } from "../lib/ids";

/**
 * WhatsApp conversations — where the channel keeps what it hears and says.
 *
 * This is `ConversationStore` from `@CC-City-Chauffeurs/whatsapp`, written
 * against Postgres. The channel decides what to say; this decides nothing
 * except what the database already enforces, and it enforces the two things
 * that matter most in the database itself, because a webhook is retried and
 * a process can be restarted halfway through anything:
 *
 *   - a provider's message id is stored once (a unique index), so a retried
 *     webhook cannot record a message twice; and
 *   - a message has at most one assistant run (a unique column), so it cannot
 *     be answered twice.
 *
 * The admin's reads of the same tables live here too, at the bottom.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ConversationRow = typeof schema.whatsappConversation.$inferSelect;
type IdentityRow = typeof schema.whatsappIdentity.$inferSelect;
type MessageRow = typeof schema.whatsappMessage.$inferSelect;

/** WhatsApp's own ceiling on a message. The column refuses anything longer. */
const MAX_BODY = 4096;

/** Provider error text can run long; the transcript needs the gist. */
const MAX_ERROR_DETAIL = 500;

/** Thrown inside `recordInbound` to roll back everything it wrote on the way to finding a duplicate. */
class DuplicateInbound extends Error {}

function toConversation(row: ConversationRow, identity: IdentityRow): Conversation {
  return {
    id: row.id,
    // Normalised to E.164 by the channel before it was ever stored.
    phone: identity.phoneE164 as E164,
    customerId: row.customerId,
    profileName: identity.profileName,
    status: row.status,
    state: row.state as ConversationState,
    lastInboundAt: row.lastInboundAt,
  };
}

function toStoredMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    direction: row.direction,
    kind: row.kind,
    author: row.author,
    body: row.body,
    createdAt: row.createdAt,
  };
}

async function loadConversation(tx: Tx, id: string): Promise<Conversation> {
  const [row] = await tx
    .select({ conversation: schema.whatsappConversation, identity: schema.whatsappIdentity })
    .from(schema.whatsappConversation)
    .innerJoin(
      schema.whatsappIdentity,
      eq(schema.whatsappIdentity.id, schema.whatsappConversation.identityId),
    )
    .where(eq(schema.whatsappConversation.id, id))
    .limit(1);
  if (!row) throw new CmsNotFoundError("This conversation");
  return toConversation(row.conversation, row.identity);
}

/**
 * The number's identity, made if this is the first time it has written.
 *
 * Insert-then-read rather than read-then-insert: two messages from a new
 * number arriving together would both read nothing and both insert, and the
 * second would be refused by the unique phone. `on conflict do nothing`
 * waits for the other to commit and then does nothing, and the read after it
 * finds whichever row won.
 */
async function identityFor(tx: Tx, message: InboundMessage, customerId: string | null) {
  await tx
    .insert(schema.whatsappIdentity)
    .values({
      id: newId("wai"),
      phoneE164: message.from,
      customerId,
      profileName: message.profileName,
    })
    .onConflictDoNothing({ target: schema.whatsappIdentity.phoneE164 });

  const [identity] = await tx
    .select()
    .from(schema.whatsappIdentity)
    .where(eq(schema.whatsappIdentity.phoneE164, message.from))
    .limit(1);
  if (!identity) throw new Error("The WhatsApp identity was neither inserted nor found.");

  // The customer link is only ever filled in, never replaced: once the office
  // knows who a number is, a later guess does not overrule it. The profile
  // name is WhatsApp's to change, so it follows whatever was sent last.
  const linkCustomer = customerId != null && identity.customerId == null;
  const renamed = message.profileName != null && message.profileName !== identity.profileName;
  if (linkCustomer || renamed) {
    const [updated] = await tx
      .update(schema.whatsappIdentity)
      .set({
        ...(linkCustomer ? { customerId } : {}),
        ...(renamed ? { profileName: message.profileName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappIdentity.id, identity.id))
      .returning();
    return updated!;
  }
  return identity;
}

/**
 * The number's one open conversation, made if there is none, and locked.
 *
 * Race-safe the same way as the identity, against the partial unique index
 * that allows one conversation that is not closed. The row lock is what puts
 * two messages on the same conversation in a single order: the second waits
 * here until the first has committed, so the message timestamps below are in
 * the order the messages were actually recorded.
 */
async function openConversationFor(tx: Tx, identity: IdentityRow) {
  const open = () =>
    tx
      .select()
      .from(schema.whatsappConversation)
      .where(
        and(
          eq(schema.whatsappConversation.identityId, identity.id),
          ne(schema.whatsappConversation.status, "closed"),
        ),
      )
      .limit(1)
      .for("update");

  let [conversation] = await open();
  if (!conversation) {
    await tx
      .insert(schema.whatsappConversation)
      .values({
        id: newId("wac"),
        identityId: identity.id,
        customerId: identity.customerId,
      })
      .onConflictDoNothing({
        target: schema.whatsappConversation.identityId,
        where: sql`${schema.whatsappConversation.status} <> 'closed'`,
      });
    [conversation] = await open();
  }
  if (!conversation) throw new Error("The WhatsApp conversation was neither inserted nor found.");
  return conversation;
}

export type WhatsAppStoreOptions = {
  /**
   * The provider replies are sent through, recorded against each one once it
   * is delivered — so the provider's id for an outbound message sits in the
   * same unique index as an inbound one.
   */
  provider?: string;
};

/** The channel's store, over Postgres. */
export function createWhatsAppStore(options: WhatsAppStoreOptions = {}): ConversationStore {
  return {
    async recordInbound(message, customerId): Promise<RecordedInbound> {
      try {
        return await db.transaction(async (tx) => {
          const identity = await identityFor(tx, message, customerId);
          const conversation = await openConversationFor(tx, identity);

          /**
           * The first idempotency layer. A retried webhook carries the same
           * provider id and inserts nothing; everything written above is
           * then rolled back by throwing, so a duplicate leaves no trace —
           * not even a renamed profile.
           *
           * `clock_timestamp()`, not the column's default `now()`: `now()` is
           * when the transaction began, which may be before a concurrent
           * message's transaction took the conversation lock above. The
           * wall clock at the insert is after the lock, so the order of
           * `created_at` is the order the messages were recorded in.
           */
          const [inserted] = await tx
            .insert(schema.whatsappMessage)
            .values({
              id: newId("wam"),
              conversationId: conversation.id,
              direction: "inbound",
              author: "customer",
              provider: message.provider,
              providerMessageId: message.providerMessageId,
              kind: message.kind,
              body: message.text.slice(0, MAX_BODY),
              delivery: "received",
              createdAt: sql`clock_timestamp()`,
            })
            .onConflictDoNothing({
              target: [schema.whatsappMessage.provider, schema.whatsappMessage.providerMessageId],
              where: sql`${schema.whatsappMessage.providerMessageId} is not null`,
            })
            .returning({ id: schema.whatsappMessage.id, createdAt: schema.whatsappMessage.createdAt });
          if (!inserted) throw new DuplicateInbound();

          const linkCustomer = conversation.customerId == null && identity.customerId != null;
          const [updated] = await tx
            .update(schema.whatsappConversation)
            .set({
              ...(linkCustomer ? { customerId: identity.customerId } : {}),
              lastInboundAt: inserted.createdAt,
              lastMessageAt: inserted.createdAt,
              updatedAt: new Date(),
            })
            .where(eq(schema.whatsappConversation.id, conversation.id))
            .returning();
          const current = updated!;

          // With a person, the message is kept for them and nothing is queued:
          // the assistant replies only in `ai_active`, and that is decided
          // here, in the same transaction that read the status.
          let runId: string | null = null;
          if (current.status === "ai_active") {
            runId = newId("war");
            await tx.insert(schema.whatsappAgentRun).values({
              id: runId,
              conversationId: current.id,
              triggeringMessageId: inserted.id,
              status: "queued",
            });
          }

          return {
            outcome: "recorded" as const,
            conversation: toConversation(current, identity),
            messageId: inserted.id,
            runId,
          };
        });
      } catch (error) {
        if (error instanceof DuplicateInbound) return { outcome: "duplicate" };
        throw error;
      }
    },

    /** One statement, so two workers cannot both see `queued` and both take it. */
    async claimRun(runId) {
      const [claimed] = await db
        .update(schema.whatsappAgentRun)
        .set({ status: "running", startedAt: sql`now()` })
        .where(and(eq(schema.whatsappAgentRun.id, runId), eq(schema.whatsappAgentRun.status, "queued")))
        .returning({
          conversationId: schema.whatsappAgentRun.conversationId,
          triggeringMessageId: schema.whatsappAgentRun.triggeringMessageId,
        });
      return claimed ?? null;
    },

    async getConversation(conversationId) {
      return loadConversation(db as unknown as Tx, conversationId);
    },

    /**
     * The most recent messages, oldest first, in the order they were
     * recorded. `created_at` is the database's clock at the moment of the
     * insert, taken after the conversation's row lock, so it is a faithful
     * order; the id breaks a tie in the same microsecond the same way every
     * time, so the channel never sees two messages swap places between reads.
     */
    async history(conversationId, limit) {
      const rows = await db
        .select()
        .from(schema.whatsappMessage)
        .where(eq(schema.whatsappMessage.conversationId, conversationId))
        .orderBy(desc(schema.whatsappMessage.createdAt), desc(schema.whatsappMessage.id))
        .limit(Math.max(0, limit));
      return rows.reverse().map(toStoredMessage);
    },

    async completeTurn(input) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(schema.whatsappConversation)
          .where(eq(schema.whatsappConversation.id, input.conversationId))
          .limit(1)
          .for("update");
        if (!current) throw new CmsNotFoundError("This conversation");

        let replyMessageId: string | null = null;
        let repliedAt: Date | null = null;
        if (input.reply != null) {
          replyMessageId = newId("wam");
          const [reply] = await tx
            .insert(schema.whatsappMessage)
            .values({
              id: replyMessageId,
              conversationId: input.conversationId,
              direction: "outbound",
              author: "assistant",
              kind: "text",
              body: input.reply,
              delivery: "pending",
              createdAt: sql`clock_timestamp()`,
            })
            .returning({ createdAt: schema.whatsappMessage.createdAt });
          repliedAt = reply!.createdAt;
        }

        // A handover writes its reason and summary; a return to the
        // assistant clears them, so the admin does not show last week's
        // reason on a conversation the assistant has since taken back.
        const handoff = input.handoff
          ? { handoffReason: input.handoff.reason, handoffSummary: input.handoff.summary }
          : input.status === "ai_active"
            ? { handoffReason: null, handoffSummary: null }
            : {};

        await tx
          .update(schema.whatsappConversation)
          .set({
            state: input.state,
            status: input.status,
            // Filled in, never erased: a turn that did not learn who the
            // customer is does not forget what an earlier one did.
            customerId: input.customerId ?? current.customerId,
            ...handoff,
            ...(repliedAt ? { lastMessageAt: repliedAt } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.whatsappConversation.id, input.conversationId));

        if (input.customerId) {
          await tx
            .update(schema.whatsappIdentity)
            .set({ customerId: input.customerId, updatedAt: new Date() })
            .where(
              and(
                eq(schema.whatsappIdentity.id, current.identityId),
                sql`${schema.whatsappIdentity.customerId} is null`,
              ),
            );
        }

        /**
         * Only a run still in flight may be finished. A run finished twice
         * would mean two replies to one message, so the second attempt fails
         * and rolls back its reply with it.
         */
        const { run } = input;
        const [finished] = await tx
          .update(schema.whatsappAgentRun)
          .set({
            status: run.outcome,
            model: run.model,
            iterations: run.iterations,
            // Names and outcomes only — see the schema. The type already has
            // no room for arguments; building the object again makes sure
            // nothing extra rides along at runtime either.
            toolCalls: run.toolCalls.map((call) => ({
              name: call.name,
              ok: call.ok,
              errorCode: call.errorCode,
              durationMs: Math.round(call.durationMs),
            })),
            inputTokens: run.usage?.inputTokens ?? null,
            outputTokens: run.usage?.outputTokens ?? null,
            cacheReadTokens: run.usage?.cacheReadTokens ?? null,
            errorCode: run.errorCode,
            durationMs: Math.round(run.durationMs),
            replyMessageId,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(schema.whatsappAgentRun.id, input.runId),
              eq(schema.whatsappAgentRun.conversationId, input.conversationId),
              inArray(schema.whatsappAgentRun.status, ["queued", "running"]),
            ),
          )
          .returning({ id: schema.whatsappAgentRun.id });
        if (!finished) {
          throw new ConflictError("This run has already finished, or belongs to another conversation.");
        }

        return { replyMessageId };
      });
    },

    async markDelivered(messageId, providerMessageId) {
      const sent = {
        delivery: "sent" as const,
        errorCode: null,
        errorDetail: null,
        sentAt: new Date(),
      };
      try {
        await db
          .update(schema.whatsappMessage)
          .set({ ...sent, provider: options.provider ?? null, providerMessageId })
          .where(eq(schema.whatsappMessage.id, messageId));
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        // The provider handed back an id already on another message. The
        // message itself has gone out, so it is recorded as sent without the
        // id rather than left looking unsent because of a clash over it.
        await db.update(schema.whatsappMessage).set(sent).where(eq(schema.whatsappMessage.id, messageId));
      }
    },

    async markUndelivered(messageId, code, detail) {
      await db
        .update(schema.whatsappMessage)
        .set({ delivery: "failed", errorCode: code, errorDetail: detail.slice(0, MAX_ERROR_DETAIL) })
        .where(eq(schema.whatsappMessage.id, messageId));
    },

    /**
     * What the last process was in the middle of when it stopped.
     *
     * A run it had taken goes back in the queue: it is answered again from
     * the message that triggered it, and the submission id derived from that
     * message means an enquiry or booking already made is found rather than
     * made twice. A reply written down but never sent is handed back to be
     * sent, oldest first.
     *
     * This takes every `running` run and every `pending` reply there is,
     * which is only safe because one process runs the channel — see the
     * comment on `lib/whatsapp.ts`. Two processes would need this narrowed to
     * work claimed by this one, or older than a lease.
     */
    async recoverInterrupted(): Promise<InterruptedWork> {
      return db.transaction(async (tx) => {
        const requeued = await tx
          .update(schema.whatsappAgentRun)
          .set({ status: "queued", startedAt: null })
          .where(eq(schema.whatsappAgentRun.status, "running"))
          .returning({ id: schema.whatsappAgentRun.id });

        const stranded = await tx
          .select({
            id: schema.whatsappMessage.id,
            conversationId: schema.whatsappMessage.conversationId,
            body: schema.whatsappMessage.body,
            phone: schema.whatsappIdentity.phoneE164,
          })
          .from(schema.whatsappMessage)
          .innerJoin(
            schema.whatsappConversation,
            eq(schema.whatsappConversation.id, schema.whatsappMessage.conversationId),
          )
          .innerJoin(
            schema.whatsappIdentity,
            eq(schema.whatsappIdentity.id, schema.whatsappConversation.identityId),
          )
          .where(
            and(
              eq(schema.whatsappMessage.direction, "outbound"),
              eq(schema.whatsappMessage.delivery, "pending"),
            ),
          )
          .orderBy(asc(schema.whatsappMessage.createdAt), asc(schema.whatsappMessage.id));

        return {
          requeuedRuns: requeued.map((run) => run.id),
          undelivered: stranded.map((message) => ({
            id: message.id,
            conversationId: message.conversationId,
            to: message.phone as E164,
            body: message.body,
          })),
        };
      });
    },

    /** Assistant turns this conversation has had since `since` — the ceiling on what one conversation may spend. */
    async runsSince(conversationId, since) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.whatsappAgentRun)
        .where(
          and(
            eq(schema.whatsappAgentRun.conversationId, conversationId),
            gte(schema.whatsappAgentRun.createdAt, since),
          ),
        );
      return row?.count ?? 0;
    },

    async queuedRuns() {
      const rows = await db
        .select({ id: schema.whatsappAgentRun.id })
        .from(schema.whatsappAgentRun)
        .where(eq(schema.whatsappAgentRun.status, "queued"))
        .orderBy(asc(schema.whatsappAgentRun.createdAt), asc(schema.whatsappAgentRun.id));
      return rows.map((row) => row.id);
    },

    async recordOperatorMessage(conversationId, body) {
      return db.transaction(async (tx) => {
        const [conversation] = await tx
          .select({ id: schema.whatsappConversation.id })
          .from(schema.whatsappConversation)
          .where(eq(schema.whatsappConversation.id, conversationId))
          .limit(1)
          .for("update");
        if (!conversation) throw new CmsNotFoundError("This conversation");

        const messageId = newId("wam");
        const [message] = await tx
          .insert(schema.whatsappMessage)
          .values({
            id: messageId,
            conversationId,
            direction: "outbound",
            author: "operator",
            kind: "text",
            body,
            delivery: "pending",
            createdAt: sql`clock_timestamp()`,
          })
          .returning({ createdAt: schema.whatsappMessage.createdAt });

        await tx
          .update(schema.whatsappConversation)
          .set({ lastMessageAt: message!.createdAt, updatedAt: new Date() })
          .where(eq(schema.whatsappConversation.id, conversationId));

        return { messageId };
      });
    },

    /**
     * One run for one message the customer is still waiting on, queued when
     * the office hands the conversation back.
     *
     * Two things make it safe to call more than once. The conversation is
     * locked and its status read inside the same transaction, so a run is
     * never queued for a conversation a person has taken back; and
     * `triggering_message_id` is unique, so a message that already has a run
     * — queued, running or long finished — gets nothing further.
     */
    async queueRun(conversationId, messageId) {
      return db.transaction(async (tx) => {
        const [conversation] = await tx
          .select({ status: schema.whatsappConversation.status })
          .from(schema.whatsappConversation)
          .where(eq(schema.whatsappConversation.id, conversationId))
          .limit(1)
          .for("update");
        if (!conversation) throw new CmsNotFoundError("This conversation");
        if (conversation.status !== "ai_active") return null;

        const runId = newId("war");
        const [queued] = await tx
          .insert(schema.whatsappAgentRun)
          .values({
            id: runId,
            conversationId,
            triggeringMessageId: messageId,
            status: "queued",
          })
          .onConflictDoNothing({ target: schema.whatsappAgentRun.triggeringMessageId })
          .returning({ id: schema.whatsappAgentRun.id });
        return queued?.id ?? null;
      });
    },

    async setStatus(conversationId, status) {
      try {
        const [updated] = await db
          .update(schema.whatsappConversation)
          .set({
            status,
            ...(status === "ai_active" ? { handoffReason: null, handoffSummary: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.whatsappConversation.id, conversationId))
          .returning({ id: schema.whatsappConversation.id });
        if (!updated) throw new CmsNotFoundError("This conversation");
      } catch (error) {
        // Reopening a closed conversation when the number has since started a
        // new one would make two open conversations, which the index refuses.
        if (isDuplicateKey(error)) {
          throw new ConflictError("This number already has an open conversation. Continue that one instead.");
        }
        throw error;
      }
    },
  };
}

function isDuplicateKey(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code;
  const causeCode = (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

// ------------------------------------------------------------------ the admin

export type ConversationSummary = {
  id: string;
  phone: string;
  profileName: string | null;
  customer: { id: string; name: string } | null;
  status: ConversationStatus;
  handoffReason: string | null;
  lastMessageAt: string | null;
  /** The last message, cut short for a list. */
  lastMessagePreview: string;
};

export type ConversationDetail = ConversationSummary & {
  handoffSummary: string | null;
  lastInboundAt: string | null;
  createdAt: string;
  messages: {
    id: string;
    direction: "inbound" | "outbound";
    author: "customer" | "assistant" | "operator";
    kind: "text" | "unsupported";
    body: string;
    delivery: "received" | "pending" | "sent" | "failed";
    errorCode: string | null;
    createdAt: string;
    sentAt: string | null;
  }[];
};

const PREVIEW_LENGTH = 120;

function preview(body: string | null | undefined) {
  if (!body) return "";
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
}

const isoOrNull = (value: Date | null) => (value ? value.toISOString() : null);

/**
 * Conversations for the admin, most recently active first. Waiting for a
 * person is what the office most needs to see, so `status` filters.
 */
export async function listConversations(status?: ConversationStatus): Promise<ConversationSummary[]> {
  const conversation = schema.whatsappConversation;
  const rows = await db
    .select({
      conversation,
      identity: schema.whatsappIdentity,
      customerName: schema.customer.name,
      lastBody: sql<string | null>`(
        select m.body from ${schema.whatsappMessage} m
         where m.conversation_id = ${conversation.id}
         order by m.created_at desc, m.id desc
         limit 1
      )`,
    })
    .from(conversation)
    .innerJoin(schema.whatsappIdentity, eq(schema.whatsappIdentity.id, conversation.identityId))
    .leftJoin(schema.customer, eq(schema.customer.id, conversation.customerId))
    .where(status ? eq(conversation.status, status) : undefined)
    .orderBy(sql`${conversation.lastMessageAt} desc nulls last`, desc(conversation.createdAt));

  return rows.map((row) => ({
    id: row.conversation.id,
    phone: row.identity.phoneE164,
    profileName: row.identity.profileName,
    customer:
      row.conversation.customerId && row.customerName != null
        ? { id: row.conversation.customerId, name: row.customerName }
        : null,
    status: row.conversation.status,
    handoffReason: row.conversation.handoffReason,
    lastMessageAt: isoOrNull(row.conversation.lastMessageAt),
    lastMessagePreview: preview(row.lastBody),
  }));
}

/** One conversation for the admin, with every message in it, oldest first. */
export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const conversation = schema.whatsappConversation;
  const [row] = await db
    .select({ conversation, identity: schema.whatsappIdentity, customerName: schema.customer.name })
    .from(conversation)
    .innerJoin(schema.whatsappIdentity, eq(schema.whatsappIdentity.id, conversation.identityId))
    .leftJoin(schema.customer, eq(schema.customer.id, conversation.customerId))
    .where(eq(conversation.id, id))
    .limit(1);
  if (!row) throw new CmsNotFoundError("This conversation");

  const messages = await db
    .select()
    .from(schema.whatsappMessage)
    .where(eq(schema.whatsappMessage.conversationId, id))
    .orderBy(asc(schema.whatsappMessage.createdAt), asc(schema.whatsappMessage.id));

  return {
    id: row.conversation.id,
    phone: row.identity.phoneE164,
    profileName: row.identity.profileName,
    customer:
      row.conversation.customerId && row.customerName != null
        ? { id: row.conversation.customerId, name: row.customerName }
        : null,
    status: row.conversation.status,
    handoffReason: row.conversation.handoffReason,
    handoffSummary: row.conversation.handoffSummary,
    lastInboundAt: isoOrNull(row.conversation.lastInboundAt),
    lastMessageAt: isoOrNull(row.conversation.lastMessageAt),
    lastMessagePreview: preview(messages.at(-1)?.body),
    createdAt: row.conversation.createdAt.toISOString(),
    messages: messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      author: message.author,
      kind: message.kind,
      body: message.body,
      delivery: message.delivery,
      errorCode: message.errorCode,
      createdAt: message.createdAt.toISOString(),
      sentAt: isoOrNull(message.sentAt),
    })),
  };
}
