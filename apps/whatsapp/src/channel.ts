/**
 * The WhatsApp channel: a message in, a reply out, everything recorded.
 *
 * `ingest` runs inside the provider's webhook and does only what must happen
 * before answering it: prove the request is genuine, record the message
 * exactly once, and queue a run. `processRun` does the rest afterwards —
 * the model, the tools, the reply — so a slow turn never makes the provider
 * give up and send the same message again.
 *
 * Three rules hold throughout.
 *
 * - **Each message is answered once.** The store refuses a provider message
 *   id it has seen, and a run exists only for a message it recorded. Records
 *   the assistant creates carry an id derived from the message, so even a
 *   turn run twice finds the enquiry it already made.
 * - **Messages are answered in order, and a burst gets one reply.** Turns
 *   for one conversation never overlap, and a turn that finds a later
 *   message waiting leaves it to that message's turn, which reads them all.
 * - **Nobody is left in silence.** A turn that fails still sends something
 *   and hands the conversation to a person.
 */

import type { ChannelDependencies, ChannelLogger, IngestResult, WhatsAppChannel } from "./channel-types";
import { escalationFor, FALLBACK_REPLY, HANDOFF_REPLY, TOO_MANY_REPLY, UNSUPPORTED_REPLY, URGENT_REPLY } from "./agent/guardrails";
import type { ModelMessage } from "./agent/model";
import { buildContext } from "./agent/prompt";
import { runAgentTurn, type TurnOutcome } from "./agent/run";
import type { Catalogue } from "./conversation/journey";
import {
  acceptsAssistantReplies,
  WebhookAuthenticationError,
  WebhookPayloadError,
  type Conversation,
  type ConversationStatus,
  type E164,
  type SendResult,
  type StoredMessage,
} from "./ports";
import { cityChauffeursTools } from "./tools/city-chauffeurs";
import type { ToolContext } from "./tools/tool";

/** WhatsApp only lets a business write freely within a day of the customer's last message. */
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The window the turn ceiling is counted over. */
const HOUR_MS = 60 * 60 * 1000;

const silent: ChannelLogger = { info() {}, warn() {}, error() {} };

/** Today in London, as "YYYY-MM-DD" — the date the business and its customers mean. */
export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

/** Only the last four digits ever reach a log line. */
const masked = (phone: string) => `…${phone.slice(-4)}`;

export function createWhatsAppChannel(deps: ChannelDependencies): WhatsAppChannel {
  const { provider, store, backend, model } = deps;
  const log = deps.log ?? silent;
  const config = {
    historyLimit: 30,
    maxIterations: 8,
    /**
     * Forty turns in an hour is far more than a person arranging a car has
     * ever needed — a long enquiry runs to a dozen — and far less than a
     * conversation stuck in a loop would reach. Past it a person takes over,
     * which is also the right answer for whoever is genuinely still typing.
     */
    maxTurnsPerHour: 40,
    maxBodyBytes: 64 * 1024,
    today: londonToday,
    ...deps.config,
  };

  /**
   * One turn at a time per conversation. The server is a single process, so
   * a map of promises is the whole of it; a second instance would need the
   * lock in the database instead.
   */
  const locks = new Map<string, Promise<unknown>>();
  async function exclusively<T>(conversationId: string, work: () => Promise<T>): Promise<T> {
    const previous = locks.get(conversationId) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    locks.set(conversationId, current);
    try {
      return await current;
    } finally {
      if (locks.get(conversationId) === current) locks.delete(conversationId);
    }
  }

  const respond = (status: number, message: string, runIds: string[] = []): IngestResult => ({
    status,
    contentType: "application/json",
    body: JSON.stringify({ error: message }),
    runIds,
  });

  async function ingest(request: { body: string; headers: Headers }): Promise<IngestResult> {
    if (new TextEncoder().encode(request.body).byteLength > config.maxBodyBytes) {
      return respond(413, "Too large.");
    }

    try {
      provider.verifySignature({ url: config.webhookUrl, body: request.body, headers: request.headers });
    } catch (error) {
      // Deliberately the same answer whatever failed: a caller probing the
      // endpoint learns nothing about which check it tripped.
      log.warn("whatsapp_signature_rejected", { provider: provider.name });
      if (error instanceof WebhookAuthenticationError) return respond(401, "Unauthorised.");
      return respond(401, "Unauthorised.");
    }

    let messages;
    try {
      messages = provider.parseInbound(request.body);
    } catch (error) {
      if (error instanceof WebhookPayloadError) {
        log.warn("whatsapp_payload_rejected", { provider: provider.name, reason: error.message });
        return respond(400, "Unreadable.");
      }
      throw error;
    }

    const runIds: string[] = [];
    for (const message of messages) {
      if (message.to !== config.ourNumber) {
        log.warn("whatsapp_not_our_number", { to: masked(message.to) });
        continue;
      }
      const customer = await backend.matchCustomer(message.from).catch(() => null);
      const recorded = await store.recordInbound(message, customer?.id ?? null);
      if (recorded.outcome === "duplicate") {
        log.info("whatsapp_duplicate_ignored", { providerMessageId: message.providerMessageId });
        continue;
      }
      log.info("whatsapp_inbound_recorded", {
        conversationId: recorded.conversation.id,
        messageId: recorded.messageId,
        runId: recorded.runId,
        kind: message.kind,
        // Length, never content: a message is the customer's to read, not the log's.
        chars: message.text.length,
      });
      if (recorded.runId) runIds.push(recorded.runId);
    }

    const acknowledgement = provider.acknowledgement();
    return { status: 200, contentType: acknowledgement.contentType, body: acknowledgement.body, runIds };
  }

  async function processRun(runId: string): Promise<void> {
    const claimed = await store.claimRun(runId);
    if (!claimed) return;
    await exclusively(claimed.conversationId, () => turn(runId, claimed.conversationId, claimed.triggeringMessageId));
  }

  async function turn(runId: string, conversationId: string, triggeringMessageId: string) {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    const conversation = await store.getConversation(conversationId);

    const skip = (reason: string) => {
      log.info("whatsapp_run_skipped", { runId, conversationId, reason });
      return store.completeTurn({
        runId,
        conversationId,
        state: conversation.state,
        status: conversation.status,
        customerId: conversation.customerId,
        handoff: null,
        reply: null,
        run: { outcome: "skipped", model: null, iterations: 0, toolCalls: [], usage: null, errorCode: reason, durationMs: elapsed() },
      });
    };

    // Checked here, after the lock, and not only when the message arrived:
    // a person may have taken the conversation over while this run waited.
    if (!acceptsAssistantReplies(conversation.status)) return void (await skip("conversation_with_a_person"));

    const history = await store.history(conversationId, config.historyLimit);
    const pending = waitingForAnswer(history, conversation);
    if (!pending.some((message) => message.id === triggeringMessageId)) return void (await skip("already_answered"));
    // A later message is waiting too: its own run will read this one with it.
    if (pending.at(-1)!.id !== triggeringMessageId) return void (await skip("superseded_by_later_message"));

    const state = structuredClone(conversation.state);
    state.answeredThrough = pending.at(-1)!.createdAt.toISOString();

    // What this conversation has already cost. Counted before the model is
    // asked, so the turn that reaches the ceiling is the one that stops.
    const recentTurns = await store.runsSince(conversationId, new Date(Date.now() - HOUR_MS));
    const overTheLimit = recentTurns > config.maxTurnsPerHour;
    if (overTheLimit) log.warn("whatsapp_turn_limit_reached", { runId, conversationId, recentTurns });

    let outcome: TurnOutcome | { reply: string; handoff: TurnOutcome["handoff"]; decided: string };
    try {
      // Over the ceiling the model is never asked: a person takes over, and
      // whatever is wrong with this conversation stops costing anything.
      outcome = overTheLimit
        ? {
            reply: TOO_MANY_REPLY,
            handoff: {
              reason: "cannot_help",
              summary: `This conversation has had ${recentTurns} assistant replies within the hour, so the assistant has stood down.`,
            },
            decided: "turn_limit",
          }
        : await decide(conversation, state, history, pending, triggeringMessageId);
    } catch (error) {
      log.error("whatsapp_turn_failed", { runId, conversationId, error: error instanceof Error ? error.name : "unknown" });
      outcome = {
        reply: FALLBACK_REPLY,
        handoff: { reason: "cannot_help", summary: "The assistant failed while answering — see the last message." },
        decided: "turn_error",
      };
    }

    const handedOver = outcome.handoff !== null;
    const status: ConversationStatus = handedOver ? "human_requested" : conversation.status;
    // A record just made may have created the customer; link them now so the
    // next turn and the admin both know who this is.
    const customer = await backend.matchCustomer(conversation.phone).catch(() => null);
    const agentRun = "iterations" in outcome ? outcome : null;
    const decided = "decided" in outcome ? outcome.decided : null;

    const { replyMessageId } = await store.completeTurn({
      runId,
      conversationId,
      state: agentRun?.state ?? state,
      status,
      customerId: customer?.id ?? conversation.customerId,
      handoff: outcome.handoff,
      reply: outcome.reply,
      run: {
        outcome: decided === "turn_error" || agentRun?.errorCode ? "failed" : "succeeded",
        model: agentRun ? model.model : null,
        iterations: agentRun?.iterations ?? 0,
        toolCalls: agentRun?.toolCalls ?? [],
        usage: agentRun?.usage ?? null,
        errorCode: agentRun?.errorCode ?? (decided === "turn_error" ? "turn_error" : null),
        durationMs: elapsed(),
      },
    });

    log.info("whatsapp_turn_completed", {
      runId,
      conversationId,
      decidedBy: decided ?? "model",
      iterations: agentRun?.iterations ?? 0,
      tools: agentRun?.toolCalls.map((call) => `${call.name}:${call.ok ? "ok" : call.errorCode}`) ?? [],
      handoff: handedOver ? outcome.handoff?.reason : null,
      corrections: agentRun?.corrections ?? [],
      inputTokens: agentRun?.usage.inputTokens ?? 0,
      outputTokens: agentRun?.usage.outputTokens ?? 0,
      durationMs: elapsed(),
      replyChars: outcome.reply.length,
    });

    if (replyMessageId) await deliver(replyMessageId, conversation, outcome.reply);
  }

  /**
   * What to say, and whether a person should take over.
   *
   * The deterministic answers come first and never reach the model: a
   * message that cannot be read, and a message that asks for a person or
   * raises something a person must handle.
   */
  async function decide(
    conversation: Conversation,
    state: Conversation["state"],
    history: StoredMessage[],
    pending: StoredMessage[],
    triggeringMessageId: string,
  ) {
    if (pending.every((message) => message.kind === "unsupported")) {
      return { reply: UNSUPPORTED_REPLY, handoff: null, decided: "unsupported_message" };
    }

    const escalation = escalationFor(pending.filter((message) => message.kind === "text").map((message) => message.body).join("\n"));
    if (escalation) {
      return {
        reply: escalation.reason === "urgent" ? URGENT_REPLY : HANDOFF_REPLY,
        handoff: { reason: escalation.reason, summary: escalation.summary },
        decided: "escalation_rule",
      };
    }

    const onFile = await backend.matchCustomer(conversation.phone).catch(() => null);
    let catalogue: Catalogue | null = null;
    const loadCatalogue = async () => {
      catalogue ??= {
        fleet: await backend.listFleet(),
        services: await backend.listServices(),
        today: config.today(),
      };
      return catalogue;
    };

    const context: ToolContext = {
      backend,
      conversation,
      state,
      catalogue: loadCatalogue,
      triggeringMessageId,
      customerName: onFile?.name ?? null,
      today: config.today(),
      handoff: null,
      createdFor: null,
    };

    // The fleet is needed to name a recorded vehicle in the context; reading
    // it only once a vehicle is recorded keeps a greeting from paying for it.
    if (state.journey.vehicleId) await loadCatalogue();

    return runAgentTurn({
      model,
      tools: cityChauffeursTools,
      context,
      history: toModelHistory(history, pending),
      contextText: () =>
        buildContext({
          today: context.today,
          customerName: context.customerName,
          profileName: conversation.profileName,
          journey: context.state.journey,
          references: context.state.references,
          fleet: catalogue?.fleet ?? null,
        }),
      maxIterations: config.maxIterations,
    });
  }

  /**
   * The office moving a conversation, and what that leaves behind.
   *
   * While a person had the conversation the customer may have written again,
   * and nothing was queued for it — correctly, because the assistant does
   * not answer over a person. Handing the conversation back has to pick that
   * message up, or it would sit there unanswered until the customer wrote
   * again, which they may never do.
   *
   * "Still waiting" is the same question a turn asks: inbound, after the last
   * turn the assistant finished, and after the last thing the office said —
   * so a message the office answered itself is not answered twice. One run is
   * queued, for the newest of them, which is the run that reads them all; and
   * the unique triggering message means asking twice queues nothing twice.
   */
  async function changeStatus(conversationId: string, status: ConversationStatus): Promise<{ runIds: string[] }> {
    await store.setStatus(conversationId, status);
    if (status !== "ai_active") return { runIds: [] };

    const conversation = await store.getConversation(conversationId);
    const pending = waitingForAnswer(await store.history(conversationId, config.historyLimit), conversation);
    if (!pending.length) return { runIds: [] };

    const runId = await store.queueRun(conversationId, pending.at(-1)!.id);
    if (!runId) return { runIds: [] };
    log.info("whatsapp_handed_back", { conversationId, runId, waiting: pending.length });
    return { runIds: [runId] };
  }

  async function deliver(
    messageId: string,
    target: { id: string; phone: E164 },
    body: string,
  ): Promise<SendResult> {
    let result = await provider.send({ to: target.phone, body });
    // One more go for a hiccup; anything else is recorded and left to a person.
    if (!result.ok && result.retryable) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      result = await provider.send({ to: target.phone, body });
    }
    if (result.ok) {
      await store.markDelivered(messageId, result.providerMessageId);
    } else {
      await store.markUndelivered(messageId, result.code, result.detail);
      log.error("whatsapp_send_failed", { messageId, conversationId: target.id, code: result.code });
    }
    return result;
  }

  /**
   * Everything the last process was in the middle of, and everything it
   * never got to.
   *
   * A restart is ordinary here — every deployment is one — and it can land
   * anywhere: between taking a run and answering it, or between writing a
   * reply down and sending it. Both are picked up, in that order:
   *
   * - A run that was being worked on goes back in the queue and is answered
   *   again from the message that triggered it. Answering it twice creates
   *   nothing twice: the enquiry or booking it may already have made carries
   *   a submission id derived from that same message, so the second attempt
   *   finds the record rather than making another.
   * - A reply that was written down but never sent is sent now, before any
   *   new turn runs, so the customer reads the conversation in order.
   *
   * Safe because one process runs the channel: anything found here belongs
   * to a process that is gone. See `docs/WHATSAPP.md`.
   */
  async function resumeQueued() {
    try {
      const { requeuedRuns, undelivered } = await store.recoverInterrupted();
      if (requeuedRuns.length || undelivered.length) {
        log.info("whatsapp_recovered_interrupted", {
          requeuedRuns: requeuedRuns.length,
          undelivered: undelivered.length,
        });
      }
      for (const message of undelivered) {
        await deliver(message.id, { id: message.conversationId, phone: message.to }, message.body).catch((error) =>
          log.error("whatsapp_resume_failed", {
            messageId: message.id,
            error: error instanceof Error ? error.name : "unknown",
          }),
        );
      }
    } catch (error) {
      // A recovery that fails must not stop the runs that are plainly queued.
      log.error("whatsapp_recovery_failed", { error: error instanceof Error ? error.name : "unknown" });
    }

    for (const runId of await store.queuedRuns()) {
      await processRun(runId).catch((error) =>
        log.error("whatsapp_resume_failed", { runId, error: error instanceof Error ? error.name : "unknown" }),
      );
    }
  }

  async function sendOperatorMessage(conversationId: string, body: string): Promise<SendResult> {
    const conversation = await store.getConversation(conversationId);
    if (conversation.status === "closed") {
      return { ok: false, retryable: false, code: "conversation_closed", detail: "The conversation is closed." };
    }
    // Outside the window WhatsApp refuses a free-form message anyway; saying
    // so here tells the office why, instead of a provider error code.
    const last = conversation.lastInboundAt?.getTime() ?? 0;
    if (Date.now() - last > SERVICE_WINDOW_MS) {
      return {
        ok: false,
        retryable: false,
        code: "outside_service_window",
        detail: "WhatsApp only allows a reply within 24 hours of the customer's last message.",
      };
    }

    return exclusively(conversationId, async () => {
      const { messageId } = await store.recordOperatorMessage(conversationId, body);
      // A person replying has taken the conversation: the assistant stops.
      if (conversation.status !== "human_active") await store.setStatus(conversationId, "human_active");
      return deliver(messageId, conversation, body);
    });
  }

  return {
    ingest,
    processRun,
    resumeQueued,
    sendOperatorMessage,
    setStatus: (conversationId, status) => exclusively(conversationId, () => changeStatus(conversationId, status)),
  };
}

/**
 * The customer's messages not yet answered, oldest first.
 *
 * "Not yet answered" means received after the last message a finished turn
 * covered, and after the last thing a person in the office said — once a
 * person has replied, what came before is theirs.
 */
function waitingForAnswer(history: StoredMessage[], conversation: Conversation): StoredMessage[] {
  const answered = conversation.state.answeredThrough ? Date.parse(conversation.state.answeredThrough) : 0;
  const lastOperator = history
    .filter((message) => message.author === "operator")
    .reduce((latest, message) => Math.max(latest, message.createdAt.getTime()), 0);
  const cutoff = Math.max(answered, lastOperator);
  return history.filter((message) => message.direction === "inbound" && message.createdAt.getTime() > cutoff);
}

/**
 * The conversation as the model reads it.
 *
 * Messages still waiting go last, whatever time they arrived: if a second
 * message came in while the first was being answered, the model should read
 * the reply to the first and then the second — which is what happened, as
 * far as the customer is concerned.
 */
function toModelHistory(history: StoredMessage[], pending: StoredMessage[]): ModelMessage[] {
  const waiting = new Set(pending.map((message) => message.id));
  const ordered = [...history.filter((message) => !waiting.has(message.id)), ...pending];

  const messages: ModelMessage[] = ordered.map((message) => {
    if (message.direction === "inbound") {
      const text =
        message.kind === "unsupported"
          ? `[The customer sent an attachment that cannot be read${message.body ? `, with the caption: ${message.body}` : ""}.]`
          : message.body;
      return { role: "user", text };
    }
    const text = message.author === "operator" ? `[Reply from a person in the City Chauffeurs office] ${message.body}` : message.body;
    return { role: "assistant", text, toolCalls: [] };
  });

  // The model has to be addressed by the customer first.
  while (messages[0]?.role === "assistant") messages.shift();
  return messages;
}
