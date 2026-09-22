/**
 * Where WhatsApp conversations are kept.
 *
 * The store is the half of the channel that has to be right when things go
 * wrong: Twilio retries a webhook it is unsure of, a process is restarted in
 * the middle of a turn, and two messages from one person arrive in the same
 * second. Every one of those is decided by what the database refuses, so it
 * is tested against a real one.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { ConversationStore, E164, InboundMessage } from "@CC-City-Chauffeurs/whatsapp/ports";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let store: ConversationStore;
let repository: typeof import("../src/repositories/whatsapp");

beforeAll(async () => {
  database = await startDatabase();
  repository = await import("../src/repositories/whatsapp");
  store = repository.createWhatsAppStore({ provider: "twilio" });
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
}, 30_000);

const AMELIA = "+447700900321" as E164;
const OURS = "+442084433332" as E164;

let sequence = 0;
const inbound = (over: Partial<InboundMessage> = {}): InboundMessage => ({
  provider: "twilio",
  providerMessageId: `SM${(sequence += 1).toString().padStart(32, "0")}`,
  to: OURS,
  from: AMELIA,
  profileName: "Amelia",
  kind: "text",
  text: "Hello — could I book a car for Saturday?",
  receivedAt: new Date(),
  ...over,
});

async function rows(sql: string) {
  return (await database.client.query(sql)).rows as Record<string, unknown>[];
}

async function count(table: string) {
  return (await rows(`select id from ${table}`)).length;
}

/** Records a message and returns the parts a test usually needs, failing loudly on a duplicate. */
async function record(message = inbound(), customerId: string | null = null) {
  const result = await store.recordInbound(message, customerId);
  if (result.outcome !== "recorded") throw new Error("Expected the message to be recorded.");
  return result;
}

const finished = (over: Record<string, unknown> = {}) => ({
  outcome: "succeeded" as const,
  model: "gpt-5.4-mini",
  iterations: 2,
  toolCalls: [{ name: "list_fleet", ok: true, errorCode: null, durationMs: 12 }],
  usage: { inputTokens: 1200, outputTokens: 80, cacheReadTokens: 900 },
  errorCode: null,
  durationMs: 1830,
  ...over,
});

describe("recording an inbound message", () => {
  test("makes the identity, the conversation, the message and a queued run", async () => {
    const result = await record();

    expect(result.conversation.phone).toBe(AMELIA);
    expect(result.conversation.status).toBe("ai_active");
    expect(result.conversation.profileName).toBe("Amelia");
    expect(result.conversation.state).toEqual({ journey: {}, references: [] });
    expect(result.conversation.lastInboundAt).toBeInstanceOf(Date);
    expect(result.runId).not.toBeNull();

    const identity = only(await rows("select * from whatsapp_identity"));
    expect(identity.phone_e164).toBe(AMELIA);
    expect(identity.id as string).toMatch(/^wai-/);

    const conversation = only(await rows("select * from whatsapp_conversation"));
    expect(conversation.id).toBe(result.conversation.id);
    expect(conversation.identity_id).toBe(identity.id);

    const message = only(await rows("select * from whatsapp_message"));
    expect(message.id).toBe(result.messageId);
    expect(message.direction).toBe("inbound");
    expect(message.author).toBe("customer");
    expect(message.delivery).toBe("received");

    const run = only(await rows("select * from whatsapp_agent_run"));
    expect(run.id).toBe(result.runId);
    expect(run.status).toBe("queued");
    expect(run.triggering_message_id).toBe(result.messageId);
  });

  test("records a retried delivery once, and writes nothing the second time", async () => {
    const message = inbound();
    await record(message);

    // Twilio retries with the same MessageSid. The profile name has changed
    // in between, to prove the duplicate leaves no trace at all.
    const again = await store.recordInbound({ ...message, profileName: "Someone Else" }, null);

    expect(again).toEqual({ outcome: "duplicate" });
    expect(await count("whatsapp_message")).toBe(1);
    expect(await count("whatsapp_agent_run")).toBe(1);
    expect(await count("whatsapp_conversation")).toBe(1);
    expect(only(await rows("select profile_name from whatsapp_identity")).profile_name).toBe("Amelia");
  });

  test("keeps adding to the one open conversation", async () => {
    const first = await record();
    const second = await record(inbound({ text: "And a second question." }));

    expect(second.conversation.id).toBe(first.conversation.id);
    expect(await count("whatsapp_conversation")).toBe(1);
    expect(await count("whatsapp_agent_run")).toBe(2);
  });

  test("queues nothing while a person has the conversation", async () => {
    const first = await record();
    await store.setStatus(first.conversation.id, "human_requested");

    const next = await record(inbound({ text: "Is anybody there?" }));

    expect(next.runId).toBeNull();
    expect(next.conversation.status).toBe("human_requested");
    expect(await count("whatsapp_message")).toBe(2);
    expect(await count("whatsapp_agent_run")).toBe(1);
  });

  test("opens a new conversation after the last one was closed", async () => {
    const first = await record();
    await store.setStatus(first.conversation.id, "closed");

    const next = await record(inbound({ text: "Hello again, a month later." }));

    expect(next.conversation.id).not.toBe(first.conversation.id);
    expect(next.conversation.status).toBe("ai_active");
    expect(next.runId).not.toBeNull();
    expect(await count("whatsapp_conversation")).toBe(2);
    expect(await count("whatsapp_identity")).toBe(1);
  });

  test("links the customer on file, and never replaces one already linked", async () => {
    await database.client.exec(`
      insert into customer (id, name, phone) values ('cus-amelia', 'Amelia Hughes', '07700 900321'),
                                                    ('cus-other', 'Somebody Else', '');
    `);
    const first = await record(inbound(), "cus-amelia");
    expect(first.conversation.customerId).toBe("cus-amelia");

    const second = await record(inbound(), "cus-other");
    expect(second.conversation.customerId).toBe("cus-amelia");
    expect(only(await rows("select customer_id from whatsapp_identity")).customer_id).toBe("cus-amelia");
  });

  test("two first messages from a new number arriving together make one identity and one conversation", async () => {
    const [a, b] = await Promise.all([
      record(inbound({ text: "One" })),
      record(inbound({ text: "Two" })),
    ]);

    expect(a.conversation.id).toBe(b.conversation.id);
    expect(await count("whatsapp_identity")).toBe(1);
    expect(await count("whatsapp_conversation")).toBe(1);
    expect(await count("whatsapp_message")).toBe(2);
  });

  test("keeps a message that is not text, without reading it", async () => {
    const result = await record(inbound({ kind: "unsupported", text: "" }));
    const [message] = await store.history(result.conversation.id, 10);
    expect(message?.kind).toBe("unsupported");
  });
});

describe("taking a run", () => {
  test("only one worker gets it", async () => {
    const { runId, messageId, conversation } = await record();

    const claims = await Promise.all([store.claimRun(runId!), store.claimRun(runId!)]);
    const won = claims.filter((claim) => claim != null);

    expect(won).toEqual([{ conversationId: conversation.id, triggeringMessageId: messageId }]);
    const run = only(await rows("select status, started_at from whatsapp_agent_run"));
    expect(run.status).toBe("running");
    expect(run.started_at).not.toBeNull();
  });

  test("a run that does not exist, or was already taken, is nobody's", async () => {
    const { runId } = await record();
    await store.claimRun(runId!);

    expect(await store.claimRun(runId!)).toBeNull();
    expect(await store.claimRun("war-missing")).toBeNull();
  });

  test("queued runs come back oldest first, and a claimed one is no longer among them", async () => {
    const first = await record(inbound({ text: "First" }));
    const second = await record(inbound({ text: "Second" }));
    expect(await store.queuedRuns()).toEqual([first.runId!, second.runId!]);

    await store.claimRun(first.runId!);
    expect(await store.queuedRuns()).toEqual([second.runId!]);
  });
});

describe("history", () => {
  test("is the most recent messages, oldest first", async () => {
    const texts = ["One", "Two", "Three", "Four"];
    let conversationId = "";
    for (const text of texts) conversationId = (await record(inbound({ text }))).conversation.id;

    const recent = await store.history(conversationId, 3);
    expect(recent.map((message) => message.body)).toEqual(["Two", "Three", "Four"]);
    expect(recent.every((message) => message.direction === "inbound")).toBe(true);
  });
});

describe("completing a turn", () => {
  test("writes the state, the reply and the run's record together", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);

    const state = {
      journey: { service: "weddings", date: "2027-05-08" },
      references: ["ENQ-1100"],
      lastRequest: { kind: "enquiry" as const, fingerprint: "abc", reference: "ENQ-1100" },
    };
    const { replyMessageId } = await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state,
      status: "ai_active",
      customerId: null,
      handoff: null,
      reply: "Thank you — your reference is ENQ-1100.",
      run: finished(),
    });

    expect(replyMessageId).not.toBeNull();
    const reply = only(await rows(`select * from whatsapp_message where id = '${replyMessageId}'`));
    expect(reply.direction).toBe("outbound");
    expect(reply.author).toBe("assistant");
    expect(reply.delivery).toBe("pending");

    const stored = await store.getConversation(conversation.id);
    expect(stored.state).toEqual(state);

    const run = only(await rows("select * from whatsapp_agent_run"));
    expect(run.status).toBe("succeeded");
    expect(run.model).toBe("gpt-5.4-mini");
    expect(run.iterations).toBe(2);
    expect(run.tool_calls).toEqual([{ name: "list_fleet", ok: true, errorCode: null, durationMs: 12 }]);
    expect(run.input_tokens).toBe(1200);
    expect(run.output_tokens).toBe(80);
    expect(run.cache_read_tokens).toBe(900);
    expect(run.duration_ms).toBe(1830);
    expect(run.reply_message_id).toBe(replyMessageId);
    expect(run.completed_at).not.toBeNull();

    const history = await store.history(conversation.id, 10);
    expect(history.map((message) => message.author)).toEqual(["customer", "assistant"]);
  });

  test("records a handover and the customer, with no reply", async () => {
    await database.client.exec(`insert into customer (id, name, phone) values ('cus-amelia', 'Amelia Hughes', '07700 900321');`);
    const { runId, conversation } = await record();
    await store.claimRun(runId!);

    const { replyMessageId } = await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: { journey: {}, references: [] },
      status: "human_requested",
      customerId: "cus-amelia",
      handoff: { reason: "asked_for_person", summary: "Wants to talk about a wedding in May." },
      reply: null,
      run: finished({ outcome: "skipped", usage: null, toolCalls: [] }),
    });

    expect(replyMessageId).toBeNull();
    const row = only(await rows("select * from whatsapp_conversation"));
    expect(row.status).toBe("human_requested");
    expect(row.handoff_reason).toBe("asked_for_person");
    expect(row.handoff_summary).toBe("Wants to talk about a wedding in May.");
    expect(row.customer_id).toBe("cus-amelia");
    expect(only(await rows("select customer_id from whatsapp_identity")).customer_id).toBe("cus-amelia");
    expect(await count("whatsapp_message")).toBe(1);

    const run = only(await rows("select * from whatsapp_agent_run"));
    expect(run.status).toBe("skipped");
    expect(run.input_tokens).toBeNull();
  });

  test("cannot finish the same run twice, and the second reply is never written", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    const turn = {
      runId: runId!,
      conversationId: conversation.id,
      state: { journey: {}, references: [] },
      status: "ai_active" as const,
      customerId: null,
      handoff: null,
      reply: "Hello!",
      run: finished(),
    };

    await store.completeTurn(turn);
    await expect(store.completeTurn(turn)).rejects.toThrow();
    expect(await count("whatsapp_message")).toBe(2);
  });
});

describe("delivery and the office", () => {
  test("a reply's delivery is recorded against it", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    const { replyMessageId } = await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: { journey: {}, references: [] },
      status: "ai_active",
      customerId: null,
      handoff: null,
      reply: "Hello!",
      run: finished(),
    });

    await store.markDelivered(replyMessageId!, "SMreply1");
    const sent = only(await rows(`select * from whatsapp_message where id = '${replyMessageId}'`));
    expect(sent.delivery).toBe("sent");
    expect(sent.provider).toBe("twilio");
    expect(sent.provider_message_id).toBe("SMreply1");
    expect(sent.sent_at).not.toBeNull();

    const { messageId } = await store.recordOperatorMessage(conversation.id, "This is Tom from the office.");
    await store.markUndelivered(messageId, "63016", "Outside the 24-hour window.");
    const failed = only(await rows(`select * from whatsapp_message where id = '${messageId}'`));
    expect(failed.author).toBe("operator");
    expect(failed.direction).toBe("outbound");
    expect(failed.delivery).toBe("failed");
    expect(failed.error_code).toBe("63016");
    expect(failed.error_detail).toBe("Outside the 24-hour window.");
  });

  test("handing back to the assistant clears the reason it was handed over", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: { journey: {}, references: [] },
      status: "human_requested",
      customerId: null,
      handoff: { reason: "asked_for_person", summary: "Summary." },
      reply: "Somebody from the office will reply shortly.",
      run: finished(),
    });

    await store.setStatus(conversation.id, "human_active");
    expect(only(await rows("select handoff_reason from whatsapp_conversation")).handoff_reason).toBe(
      "asked_for_person",
    );

    await store.setStatus(conversation.id, "ai_active");
    const row = only(await rows("select * from whatsapp_conversation"));
    expect(row.status).toBe("ai_active");
    expect(row.handoff_reason).toBeNull();
    expect(row.handoff_summary).toBeNull();
  });

  test("a closed conversation cannot be reopened beside a newer open one", async () => {
    const first = await record();
    await store.setStatus(first.conversation.id, "closed");
    await record(inbound({ text: "A new conversation." }));

    await expect(store.setStatus(first.conversation.id, "ai_active")).rejects.toThrow(
      /already has an open conversation/,
    );
  });

  test("an unknown conversation is not found", async () => {
    await expect(store.getConversation("wac-missing")).rejects.toThrow();
    await expect(store.setStatus("wac-missing", "closed")).rejects.toThrow();
    await expect(store.recordOperatorMessage("wac-missing", "Hello")).rejects.toThrow();
  });

  test("the admin's list shows the latest message and filters by status", async () => {
    const first = await record(inbound({ text: "x".repeat(300) }));
    await record(inbound({ from: "+447700900654" as E164, profileName: "Ben", text: "Hi" }));
    await store.setStatus(first.conversation.id, "human_requested");

    const all = await repository.listConversations();
    expect(all).toHaveLength(2);
    const waiting = await repository.listConversations("human_requested");
    expect(waiting.map((item) => item.id)).toEqual([first.conversation.id]);
    expect(waiting[0]!.lastMessagePreview.length).toBeLessThanOrEqual(120);

    const detail = await repository.getConversationDetail(first.conversation.id);
    expect(detail.messages).toHaveLength(1);
    expect(detail.phone).toBe(AMELIA);
  });
});

describe("picking up after a restart", () => {
  test("a run that was being worked on goes back in the queue", async () => {
    const { runId } = await record();
    await store.claimRun(runId!);
    expect(await store.queuedRuns()).toEqual([]);

    const recovered = await store.recoverInterrupted();

    expect(recovered.requeuedRuns).toEqual([runId!]);
    expect(await store.queuedRuns()).toEqual([runId!]);
    // Claimable again, which is what lets the turn run a second time.
    expect(await store.claimRun(runId!)).not.toBeNull();
    expect(only(await rows("select started_at from whatsapp_agent_run")).started_at).not.toBeNull();
  });

  test("a run nobody had started is left exactly as it was", async () => {
    const { runId } = await record();

    const recovered = await store.recoverInterrupted();

    expect(recovered.requeuedRuns).toEqual([]);
    expect(await store.queuedRuns()).toEqual([runId!]);
  });

  test("a run that finished is not run again", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: conversation.state,
      status: "ai_active",
      customerId: null,
      handoff: null,
      reply: "Of course — which day?",
      run: finished(),
    });

    expect((await store.recoverInterrupted()).requeuedRuns).toEqual([]);
    expect(await store.queuedRuns()).toEqual([]);
  });

  test("a reply written down but never sent comes back, with somewhere to send it", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    const { replyMessageId } = await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: conversation.state,
      status: "ai_active",
      customerId: null,
      handoff: null,
      reply: "Of course — which day?",
      run: finished(),
    });

    const { undelivered } = await store.recoverInterrupted();

    expect(undelivered).toEqual([
      { id: replyMessageId!, conversationId: conversation.id, to: AMELIA, body: "Of course — which day?" },
    ]);
  });

  test("a reply already sent, and one already given up on, are both left alone", async () => {
    const { runId, conversation } = await record();
    await store.claimRun(runId!);
    const { replyMessageId } = await store.completeTurn({
      runId: runId!,
      conversationId: conversation.id,
      state: conversation.state,
      status: "ai_active",
      customerId: null,
      handoff: null,
      reply: "Of course — which day?",
      run: finished(),
    });
    await store.markDelivered(replyMessageId!, "SM99999999999999999999999999999999");

    expect((await store.recoverInterrupted()).undelivered).toEqual([]);

    const { messageId: operatorMessage } = await store.recordOperatorMessage(conversation.id, "Faheem here.");
    await store.markUndelivered(operatorMessage, "twilio_63016", "Outside the window.");
    expect((await store.recoverInterrupted()).undelivered).toEqual([]);
  });

  test("an inbound message is never mistaken for something to send", async () => {
    await record();
    expect((await store.recoverInterrupted()).undelivered).toEqual([]);
  });
});

describe("what a conversation has already cost", () => {
  test("its own turns are counted, and only recent ones", async () => {
    const { conversation } = await record();
    await record(inbound());
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    expect(await store.runsSince(conversation.id, hourAgo)).toBe(2);
    expect(await store.runsSince(conversation.id, new Date(Date.now() + 1000))).toBe(0);
  });

  test("another conversation's turns are not this one's", async () => {
    const { conversation } = await record();
    await record(inbound({ from: "+447700900999" as E164 }));
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    expect(await store.runsSince(conversation.id, hourAgo)).toBe(1);
  });
});
