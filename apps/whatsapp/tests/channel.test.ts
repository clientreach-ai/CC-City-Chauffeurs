/**
 * The channel, end to end, with a scripted model.
 *
 * Each test drives real webhook payloads through `ingest`, runs the queued
 * turn, and checks what was sent, what was recorded and what the model was
 * shown. The model is scripted, so a test states exactly what the model
 * decided and proves what the application did with it.
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { createWhatsAppChannel } from "../src/channel";
import { calls, callsMany, fails, refuses, says, ScriptedModel, type ScriptStep } from "../src/agent/scripted";
import { HANDOFF_REPLY, UNSUPPORTED_REPLY, FALLBACK_REPLY } from "../src/agent/guardrails";
import { CUSTOMER, FakeBackend, MemoryStore, OUR_NUMBER, inbound, simulator } from "./support";

let store: MemoryStore;
let backend: FakeBackend;
let provider: ReturnType<typeof simulator>;
let model: ScriptedModel;

function channel(script: ScriptStep[] = []) {
  model = new ScriptedModel(script);
  return createWhatsAppChannel({
    provider,
    store,
    backend,
    model,
    config: { webhookUrl: "https://api.example/whatsapp", ourNumber: OUR_NUMBER, today: () => "2027-01-10" },
  });
}

/** A message arrives and its turn runs to completion. */
async function say(whatsapp: ReturnType<typeof channel>, id: string, text: string, options = {}) {
  const result = await whatsapp.ingest({ body: inbound(id, text, options), headers: new Headers() });
  for (const runId of result.runIds) await whatsapp.processRun(runId);
  return result;
}

const lastSent = () => provider.sent.at(-1)?.body;

beforeEach(() => {
  store = new MemoryStore();
  backend = new FakeBackend();
  provider = simulator();
});

describe("a conversation", () => {
  test("a greeting gets the model's greeting back, sent and recorded", async () => {
    const whatsapp = channel([says("Hello, welcome to City Chauffeurs. How can I help?")]);
    const result = await say(whatsapp, "m1", "Hi");

    expect(result.status).toBe(200);
    expect(provider.sent).toEqual([{ to: CUSTOMER, body: "Hello, welcome to City Chauffeurs. How can I help?" }]);

    const directions = store.messages.map((message) => `${message.direction}:${message.delivery}`);
    expect(directions).toEqual(["inbound:received", "outbound:sent"]);
    expect(model.requests[0]!.messages).toEqual([{ role: "user", text: "Hi" }]);
  });

  test("the fleet comes from the backend, not the model's memory", async () => {
    const whatsapp = channel([calls("get_fleet"), says("We have the Cullinan, the Ghost, the S-Class…")]);
    await say(whatsapp, "m1", "What cars do you have?");

    // The second request carries the tool result the first one asked for.
    const results = model.requests[1]!.messages.at(-1);
    expect(results?.role).toBe("tool_results");
    const content = JSON.parse((results as { results: { content: string }[] }).results[0]!.content);
    expect(content.ok).toBe(true);
    expect(content.data.vehicles.map((vehicle: { name: string }) => vehicle.name)).toContain("Rolls-Royce Cullinan");
    expect(lastSent()).toContain("Cullinan");
  });

  test("a service question reads the real service", async () => {
    const whatsapp = channel([calls("get_service", { service: "airport transfers" }), says("Yes — we do airport transfers.")]);
    await say(whatsapp, "m1", "Do you do airport transfers?");

    const results = model.requests[1]!.messages.at(-1) as { results: { content: string }[] };
    expect(JSON.parse(results.results[0]!.content).data.name).toBe("Airport Transfers");
  });
});

describe("an enquiry", () => {
  test("is collected over several messages and recorded with the right vehicle and number", async () => {
    const whatsapp = channel([
      calls("record_journey_details", { pickup: "Heathrow", dropoff: "Mayfair", date: "2027-01-11", time: "20:00" }),
      says("How many passengers, and do you have a vehicle in mind?"),
      calls("record_journey_details", { passengers: 3, vehicle: "S Class" }),
      says("And your name, please?"),
      calls("record_journey_details", { name: "Amelia Hughes" }),
      says("Heathrow to Mayfair tomorrow at 20:00, 3 passengers, Mercedes S-Class. Shall I send this to the team?"),
      calls("create_enquiry"),
      says("Your enquiry has been received. Your reference is ENQ-1101."),
    ]);

    await say(whatsapp, "m1", "I need a Heathrow to Mayfair transfer tomorrow at 8pm.");
    await say(whatsapp, "m2", "3 passengers, S Class.");
    await say(whatsapp, "m3", "Amelia Hughes");
    await say(whatsapp, "m4", "Yes please");

    expect(backend.created).toHaveLength(1);
    const [enquiry] = backend.created;
    expect(enquiry!.kind).toBe("enquiry");
    expect(enquiry!.customer).toEqual({ name: "Amelia Hughes", phone: CUSTOMER, email: "" });
    // "S Class" became a real vehicle, not a sentence in the notes.
    expect(enquiry!.journey.vehicleId).toBe("veh-sclass");
    expect(enquiry!.journey).toMatchObject({ pickup: "Heathrow", dropoff: "Mayfair", date: "2027-01-11", time: "20:00", passengers: 3 });
    expect(enquiry!.submissionId).toStartWith("wa:");

    expect(lastSent()).toContain("ENQ-1101");
    // The customer is linked once the record made them one.
    expect(store.only().customerId).toBe("cus-1");
  });

  test("the draft survives between messages, so nothing is asked twice", async () => {
    const whatsapp = channel([
      calls("record_journey_details", { pickup: "Heathrow" }),
      says("Where to?"),
      says("Noted."),
    ]);
    await say(whatsapp, "m1", "Airport transfer from Heathrow");
    await say(whatsapp, "m2", "To Mayfair");

    // The second turn's context tells the model what is already known.
    expect(model.requests.at(-1)!.context).toContain("pickup: Heathrow");
  });

  test("asking again for the same journey returns the same reference", async () => {
    const whatsapp = channel([
      calls("record_journey_details", { name: "Amelia", pickup: "Heathrow" }),
      calls("create_enquiry"),
      says("ENQ-1101"),
      calls("create_enquiry"),
      says("Already recorded — ENQ-1101"),
    ]);
    await say(whatsapp, "m1", "Heathrow please, I'm Amelia");
    await say(whatsapp, "m2", "Can you send that again?");

    expect(backend.created).toHaveLength(1);
  });

  test("cannot be recorded before the essentials are known", async () => {
    const whatsapp = channel([calls("create_enquiry"), says("May I take your name?")]);
    await say(whatsapp, "m1", "I'd like a car");

    expect(backend.created).toHaveLength(0);
    const results = model.requests[1]!.messages.at(-1) as { results: { content: string; isError: boolean }[] };
    expect(results.results[0]!.isError).toBe(true);
    expect(JSON.parse(results.results[0]!.content).error.code).toBe("incomplete");
  });
});

describe("a booking request", () => {
  test("is recorded as a request with its vehicle, only once it has a date", async () => {
    const whatsapp = channel([
      calls("record_journey_details", { name: "Amelia Hughes", vehicle: "S Class", pickup: "The Savoy" }),
      calls("create_booking_request"),
      says("What date would you like?"),
      calls("record_journey_details", { date: "2027-02-14", time: "19:00" }),
      calls("create_booking_request"),
      says("Your booking request is BKG-2101. The team will confirm."),
    ]);
    await say(whatsapp, "m1", "I'd like to request the S Class from the Savoy");
    await say(whatsapp, "m2", "14 February at 7pm");

    expect(backend.created).toHaveLength(1);
    expect(backend.created[0]).toMatchObject({
      kind: "booking",
      reference: "BKG-2101",
      journey: { vehicleId: "veh-sclass", date: "2027-02-14", pickup: "The Savoy" },
    });
    expect(lastSent()).toContain("BKG-2101");
  });
});

describe("what the model is not trusted with", () => {
  test("an ambiguous vehicle is refused, not guessed", async () => {
    const whatsapp = channel([calls("record_journey_details", { vehicle: "Rolls-Royce" }), says("The Cullinan or the Ghost?")]);
    await say(whatsapp, "m1", "A Rolls-Royce please");

    expect(store.only().state.journey.vehicleId).toBeUndefined();
    const results = model.requests[1]!.messages.at(-1) as { results: { content: string }[] };
    const refused = JSON.parse(results.results[0]!.content).data.refused;
    expect(refused[0].reason).toContain("Rolls-Royce Cullinan");
    expect(refused[0].reason).toContain("Rolls-Royce Ghost");
  });

  test("a date in the past, or one that does not exist, is refused", async () => {
    const whatsapp = channel([
      callsMany(["record_journey_details", { date: "2026-12-01" }], ["record_journey_details", { date: "2027-02-31" }]),
      says("Which date?"),
    ]);
    await say(whatsapp, "m1", "Book it for last month");
    expect(store.only().state.journey.date).toBeUndefined();
  });

  test("an argument outside the schema is sent back, and nothing runs", async () => {
    const whatsapp = channel([calls("record_journey_details", { passengers: "lots", colour: "red" }), says("How many passengers?")]);
    await say(whatsapp, "m1", "A big group");

    const results = model.requests[1]!.messages.at(-1) as { results: { content: string }[] };
    expect(JSON.parse(results.results[0]!.content).error.code).toBe("invalid_arguments");
    expect(store.only().state.journey).toEqual({});
  });

  test("a tool that does not exist is reported, not crashed on", async () => {
    const whatsapp = channel([calls("confirm_booking", { reference: "BKG-1" }), says("I can't confirm bookings.")]);
    await say(whatsapp, "m1", "Confirm my booking");

    const run = [...store.runs.values()][0]!.record as { toolCalls: { name: string; errorCode: string }[] };
    expect(run.toolCalls[0]).toMatchObject({ name: "confirm_booking", errorCode: "unknown_tool" });
    expect(backend.created).toHaveLength(0);
  });

  test("someone else's reference looks exactly like one that does not exist", async () => {
    const other = "+447700900999";
    backend.created.push({
      kind: "enquiry",
      reference: "ENQ-9999",
      submissionId: "x",
      customer: { name: "Somebody Else", phone: other as never, email: "" },
      journey: {} as never,
    });
    const whatsapp = channel([calls("get_enquiry_status", { reference: "ENQ-9999" }), says("I can't find that one.")]);
    await say(whatsapp, "m1", "What's the status of ENQ-9999?");

    const results = model.requests[1]!.messages.at(-1) as { results: { content: string }[] };
    expect(JSON.parse(results.results[0]!.content).error.code).toBe("not_found");
  });
});

describe("a person", () => {
  test("is handed the conversation without the model being asked", async () => {
    const whatsapp = channel([says("this must never be said")]);
    await say(whatsapp, "m1", "I want to speak to someone.");

    expect(model.requests).toHaveLength(0);
    expect(lastSent()).toBe(HANDOFF_REPLY);
    const conversation = store.only();
    expect(conversation.status).toBe("human_requested");
    expect(conversation.handoff?.reason).toBe("customer_asked");
  });

  test("once handed over, the assistant stays silent", async () => {
    const whatsapp = channel([says("never")]);
    await say(whatsapp, "m1", "Can I talk to a person?");
    const result = await say(whatsapp, "m2", "Hello? Is anyone there?");

    expect(result.runIds).toEqual([]);
    expect(provider.sent).toHaveLength(1);
    expect(store.messages.filter((message) => message.direction === "inbound")).toHaveLength(2);
  });

  test("is also brought in when the model decides it cannot help", async () => {
    const whatsapp = channel([
      calls("handoff_to_human", { reason: "existing_booking", summary: "Wants to change tomorrow's pickup time." }),
      says("never said"),
    ]);
    await say(whatsapp, "m1", "Can I move my pickup tomorrow to 9?");

    expect(lastSent()).toBe(HANDOFF_REPLY);
    expect(store.only().handoff).toEqual({ reason: "existing_booking", summary: "Wants to change tomorrow's pickup time." });
  });

  test("who replies from the office takes the conversation over", async () => {
    const whatsapp = channel([says("Hello!")]);
    await say(whatsapp, "m1", "Hi");
    const conversation = store.only();

    const result = await whatsapp.sendOperatorMessage(conversation.id, "Hi Amelia, this is Faheem.");
    expect(result.ok).toBe(true);
    expect(store.only().status).toBe("human_active");
    expect(lastSent()).toBe("Hi Amelia, this is Faheem.");

    const next = await say(whatsapp, "m2", "Thanks Faheem");
    expect(next.runIds).toEqual([]);
  });

  test("cannot write outside WhatsApp's 24-hour window", async () => {
    const whatsapp = channel([says("Hello!")]);
    await say(whatsapp, "m1", "Hi");
    const conversation = store.only();
    store.conversations.get(conversation.id)!.lastInboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const result = await whatsapp.sendOperatorMessage(conversation.id, "Following up");
    expect(result).toMatchObject({ ok: false, code: "outside_service_window" });
  });
});

describe("delivery", () => {
  test("the same message delivered twice is recorded once, run once, answered once", async () => {
    const whatsapp = channel([calls("record_journey_details", { name: "Amelia", pickup: "Heathrow" }), calls("create_enquiry"), says("ENQ-1101")]);
    const first = await say(whatsapp, "m1", "Heathrow please, Amelia");
    const second = await say(whatsapp, "m1", "Heathrow please, Amelia");

    expect(first.runIds).toHaveLength(1);
    expect(second.runIds).toHaveLength(0);
    expect(second.status).toBe(200);
    expect(store.messages.filter((message) => message.direction === "inbound")).toHaveLength(1);
    expect(store.runs.size).toBe(1);
    expect(provider.sent).toHaveLength(1);
    expect(backend.created).toHaveLength(1);
  });

  test("a run processed twice does nothing the second time", async () => {
    const whatsapp = channel([says("Hello")]);
    const result = await whatsapp.ingest({ body: inbound("m1", "Hi"), headers: new Headers() });
    await whatsapp.processRun(result.runIds[0]!);
    await whatsapp.processRun(result.runIds[0]!);
    expect(provider.sent).toHaveLength(1);
  });

  test("three quick messages get one reply, which reads all three", async () => {
    const whatsapp = channel([says("Got it — Heathrow to Mayfair for three.")]);
    const runIds: string[] = [];
    for (const [id, text] of [["m1", "Hi"], ["m2", "Heathrow to Mayfair"], ["m3", "3 of us"]] as const) {
      runIds.push(...(await whatsapp.ingest({ body: inbound(id, text), headers: new Headers() })).runIds);
    }
    await Promise.all(runIds.map((runId) => whatsapp.processRun(runId)));

    expect(provider.sent).toHaveLength(1);
    expect(model.requests).toHaveLength(1);
    expect(model.requests[0]!.messages.map((message) => (message as { text: string }).text)).toEqual([
      "Hi",
      "Heathrow to Mayfair",
      "3 of us",
    ]);
  });

  test("a message that arrives while the last is being answered is answered after it", async () => {
    const whatsapp = channel([says("Hello! How can I help?"), says("Certainly — where from?")]);

    // Hold the model's first answer until the second message has landed —
    // the real race: the first turn has read its history and is thinking.
    let release!: () => void;
    let thinking!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const started = new Promise<void>((resolve) => (thinking = resolve));
    const respond = model.respond.bind(model);
    let first = true;
    model.respond = async (request) => {
      if (first) {
        first = false;
        thinking();
        await gate;
      }
      return respond(request);
    };

    const one = await whatsapp.ingest({ body: inbound("m1", "Hi"), headers: new Headers() });
    const firstTurn = whatsapp.processRun(one.runIds[0]!);
    await started;
    const two = await whatsapp.ingest({ body: inbound("m2", "I need a car"), headers: new Headers() });
    release();
    await firstTurn;
    await whatsapp.processRun(two.runIds[0]!);

    expect(provider.sent.map((message) => message.body)).toEqual(["Hello! How can I help?", "Certainly — where from?"]);
    // The second turn saw the first reply before the second message.
    const shown = model.requests[1]!.messages.map((message) => message.role);
    expect(shown.at(-1)).toBe("user");
  });

  test("a photo gets a plain answer, without the model", async () => {
    const whatsapp = channel([says("never")]);
    await say(whatsapp, "m1", "", { type: "image" });

    expect(model.requests).toHaveLength(0);
    expect(lastSent()).toBe(UNSUPPORTED_REPLY);
  });

  test("a message to a number that is not ours is not answered", async () => {
    const whatsapp = channel([says("never")]);
    const result = await say(whatsapp, "m1", "Hi", { to: "+442071234567" });
    expect(result.runIds).toEqual([]);
    expect(store.messages).toHaveLength(0);
  });

  test("an oversized body is refused before anything is read", async () => {
    const whatsapp = channel();
    const result = await whatsapp.ingest({ body: "x".repeat(70 * 1024), headers: new Headers() });
    expect(result.status).toBe(413);
  });

  test("a payload that is not a message is refused", async () => {
    const whatsapp = channel();
    const result = await whatsapp.ingest({ body: '{"not":"a message"}', headers: new Headers() });
    expect(result.status).toBe(400);
  });
});

describe("when things go wrong, the customer still hears something", () => {
  test("the model cannot be reached", async () => {
    const whatsapp = channel([fails()]);
    await say(whatsapp, "m1", "Hi");
    expect(lastSent()).toBe(FALLBACK_REPLY);
    expect(store.only().status).toBe("human_requested");
  });

  test("the model declines", async () => {
    const whatsapp = channel([refuses()]);
    await say(whatsapp, "m1", "Hi");
    expect(lastSent()).toBe(FALLBACK_REPLY);
  });

  test("the model goes round in circles", async () => {
    const circling = Array.from({ length: 12 }, () => calls("get_fleet"));
    const whatsapp = channel(circling);
    await say(whatsapp, "m1", "Tell me everything");

    expect(model.requests).toHaveLength(8);
    expect(lastSent()).toBe(FALLBACK_REPLY);
    expect(store.only().status).toBe("human_requested");
  });

  test("a reference made before a failure is not lost", async () => {
    const whatsapp = channel([calls("record_journey_details", { name: "Amelia", pickup: "Heathrow" }), calls("create_enquiry"), fails()]);
    await say(whatsapp, "m1", "Heathrow, Amelia");
    expect(lastSent()).toContain("ENQ-1101");
  });

  test("a failed send is recorded against the message", async () => {
    provider.failNext({ ok: false, retryable: false, code: "twilio_21211", detail: "Invalid number" });
    const whatsapp = channel([says("Hello")]);
    await say(whatsapp, "m1", "Hi");
    expect(store.messages.at(-1)!.delivery).toBe("failed");
  });
});

describe("staying on subject", () => {
  test("the model is told, every turn, what it may and may not claim", async () => {
    const whatsapp = channel([says("I can only help with City Chauffeurs.")]);
    await say(whatsapp, "m1", "Write me a poem about the sea");

    const request = model.requests[0]!;
    expect(request.system).toContain("You help with City Chauffeurs only");
    expect(request.system).toContain("Never say a vehicle is available");
    expect(request.context).toContain("2027-01-10");
    // The rules are identical on every request, so they cache.
    await say(whatsapp, "m2", "Please?");
    expect(model.requests[1]!.system).toBe(request.system);
  });
});
