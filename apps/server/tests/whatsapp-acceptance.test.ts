/**
 * Stage 6 acceptance: a WhatsApp conversation, all the way to the admin.
 *
 * Everything here is the real thing except the model and the network: the
 * simulator provider, the real channel, the real conversation store, the real
 * backend adapter, the real enquiry and booking repositories, and Postgres
 * migrated by the real migrations. The model is scripted, so each test states
 * what the model decided and proves what the system did with it — and every
 * record is checked in the same tables the admin reads.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  calls,
  createWhatsAppChannel,
  says,
  ScriptedModel,
  SimulatorProvider,
  type E164,
  type ScriptStep,
  type WhatsAppChannel,
} from "@CC-City-Chauffeurs/whatsapp";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

const OURS = "+442084433332" as E164;
const AMELIA = "+447700900321";

let database: TestDatabase;
let provider: SimulatorProvider;
let model: ScriptedModel;
let whatsapp: WhatsAppChannel;
let factories: {
  createWhatsAppStore: typeof import("../src/repositories/whatsapp").createWhatsAppStore;
  createWhatsAppBackend: typeof import("../src/lib/whatsapp-backend").createWhatsAppBackend;
};

beforeAll(async () => {
  database = await startDatabase();
  factories = {
    createWhatsAppStore: (await import("../src/repositories/whatsapp")).createWhatsAppStore,
    createWhatsAppBackend: (await import("../src/lib/whatsapp-backend")).createWhatsAppBackend,
  };
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
  // The published fleet and services the assistant reads — the same rows the
  // website's /fleet and /chauffeur-services pages read.
  await database.client.exec(`
    delete from service_vehicle; delete from service; delete from vehicle;
    insert into vehicle (id, slug, name, make, model, status, specs)
    values ('veh-sclass', 's-class', 'Mercedes S-Class', 'Mercedes', 'S-Class', 'published',
            '{"passengers":3,"luggage":"2 large cases","year":null,"transmission":"","bodyType":""}'::jsonb),
           ('veh-cullinan', 'cullinan', 'Rolls-Royce Cullinan', 'Rolls-Royce', 'Cullinan', 'published',
            '{"passengers":3,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb),
           ('veh-draft', 'secret', 'Unreleased Prototype', 'Nobody', 'Prototype', 'draft',
            '{"passengers":null,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb);
    insert into service (id, slug, name, summary, status, booking)
    values ('svc-airport', 'airport-transfers', 'Airport Transfers', 'Meet and greet at every London airport.', 'published',
            '{"needs":["Flight number","Terminal"],"note":""}'::jsonb);
    insert into service_vehicle (service_id, vehicle_id, position) values ('svc-airport', 'veh-sclass', 0);
  `);
}, 30_000);

function start(script: ScriptStep[]) {
  provider = new SimulatorProvider({ ourNumber: OURS });
  model = new ScriptedModel(script);
  whatsapp = createWhatsAppChannel({
    provider,
    store: factories.createWhatsAppStore({ provider: provider.name }),
    backend: factories.createWhatsAppBackend(),
    model,
    config: { webhookUrl: "http://localhost/api/whatsapp/simulator", ourNumber: OURS, today: () => "2027-01-10" },
    log: { info() {}, warn() {}, error() {} },
  });
}

async function customerSays(id: string, text: string, from = AMELIA) {
  const body = JSON.stringify({ messages: [{ id, from, to: OURS, name: "Amelia", type: "text", text }] });
  const result = await whatsapp.ingest({ body, headers: new Headers() });
  for (const runId of result.runIds) await whatsapp.processRun(runId);
  return result;
}

async function rows(sql: string) {
  return (await database.client.query(sql)).rows as Record<string, unknown>[];
}

const lastReply = () => provider.sent.at(-1)?.body ?? "";

/** The tool result the model was shown in answer to its last call. */
function lastToolResult() {
  for (const request of [...model.requests].reverse()) {
    const message = request.messages.at(-1);
    if (message?.role === "tool_results") return JSON.parse(message.results[0]!.content);
  }
  throw new Error("no tool result was shown to the model");
}

describe("Scenario 1 — greeting", () => {
  test("hi gets a City Chauffeurs greeting, and the conversation is on record", async () => {
    start([says("Hello, welcome to City Chauffeurs. How can I help?")]);
    await customerSays("SM1", "Hi");

    expect(lastReply()).toBe("Hello, welcome to City Chauffeurs. How can I help?");
    const conversation = only(await rows("select * from whatsapp_conversation"));
    expect(conversation.status).toBe("ai_active");
    const messages = await rows("select direction, author, delivery from whatsapp_message order by created_at");
    expect(messages).toEqual([
      { direction: "inbound", author: "customer", delivery: "received" },
      { direction: "outbound", author: "assistant", delivery: "sent" },
    ]);
  });
});

describe("Scenario 2 — fleet", () => {
  test("the fleet is the published fleet in the database, and nothing else", async () => {
    start([calls("get_fleet"), says("We have the Mercedes S-Class and the Rolls-Royce Cullinan.")]);
    await customerSays("SM1", "What cars do you have?");

    const names = lastToolResult().data.vehicles.map((vehicle: { name: string }) => vehicle.name);
    expect(names.sort()).toEqual(["Mercedes S-Class", "Rolls-Royce Cullinan"]);
    // A draft vehicle is not something a customer can be told about.
    expect(names).not.toContain("Unreleased Prototype");
  });

  test("a vehicle's figures are the client's, not the model's", async () => {
    start([calls("get_vehicle", { vehicle: "S Class" }), says("The S-Class seats three.")]);
    await customerSays("SM1", "Tell me about the S Class");

    expect(lastToolResult().data.vehicle).toMatchObject({ name: "Mercedes S-Class", passengers: 3, luggage: "2 large cases" });
  });
});

describe("Scenario 3 — service", () => {
  test("airport transfers are read from the real service record", async () => {
    start([calls("get_service", { service: "airport transfers" }), says("Yes, we do airport transfers.")]);
    await customerSays("SM1", "Do you do airport transfers?");

    expect(lastToolResult().data).toMatchObject({
      name: "Airport Transfers",
      toQuoteTheOfficeNeeds: ["Flight number", "Terminal"],
      vehicles: ["Mercedes S-Class"],
    });
  });
});

describe("Scenario 4 — enquiry", () => {
  test("a transfer described in pieces becomes one enquiry, from WhatsApp, with its car and its customer", async () => {
    start([
      calls("record_journey_details", { pickup: "Heathrow", dropoff: "Mayfair", date: "2027-01-11", time: "20:00" }),
      says("How many passengers, and do you have a vehicle in mind?"),
      calls("record_journey_details", { passengers: 3, vehicle: "S Class" }),
      says("And your name?"),
      calls("record_journey_details", { name: "Amelia Hughes" }),
      says("Heathrow to Mayfair tomorrow at 20:00, three passengers, Mercedes S-Class. Shall I send it?"),
      calls("create_enquiry"),
      says("Your enquiry has been received. Your reference is ENQ-1100."),
    ]);

    await customerSays("SM1", "I need a Heathrow to Mayfair transfer tomorrow at 8pm.");
    await customerSays("SM2", "3 passengers, S Class.");
    await customerSays("SM3", "Amelia Hughes");
    await customerSays("SM4", "Yes");

    // Admin → Enquiries: the row the admin lists.
    const enquiry = only(await rows("select * from enquiry"));
    expect(enquiry.reference).toBe("ENQ-1100");
    expect(enquiry.source).toBe("whatsapp");
    expect(enquiry.status).toBe("new");
    expect(enquiry.journey).toMatchObject({
      vehicleId: "veh-sclass",
      pickup: "Heathrow",
      dropoff: "Mayfair",
      date: "2027-01-11",
      time: "20:00",
      passengers: 3,
    });

    // Admin → Customers: the right person, reachable on this number.
    const customer = only(await rows(`select * from customer where id = '${enquiry.customer_id}'`));
    expect(customer.name).toBe("Amelia Hughes");
    expect(String(customer.phone).replace(/\D/g, "").slice(-10)).toBe("7700900321");

    // The conversation now knows who it is talking to.
    expect(only(await rows("select customer_id from whatsapp_conversation")).customer_id).toBe(enquiry.customer_id);
    // The reference the customer was given is the one in the database.
    expect(lastToolResult().data.reference).toBe("ENQ-1100");
  });

  test("a returning customer is matched, however they wrote their number before", async () => {
    // Amelia rang the office last month and gave her number the national way.
    await database.client.exec(`
      insert into customer (id, name, type, company, phone, email, notes)
      values ('cus-amelia', 'Amelia Hughes', 'private', '', '07700 900321', '', '');
    `);
    start([
      calls("record_journey_details", { pickup: "Claridge's", notes: "Airport run next month" }),
      calls("create_enquiry"),
      says("Thank you, Amelia — ENQ-1100."),
    ]);
    await customerSays("SM1", "Hi, it's Amelia — a car from Claridge's next month please");

    expect(await rows("select id from customer")).toHaveLength(1);
    expect(only(await rows("select customer_id from enquiry")).customer_id).toBe("cus-amelia");
    // The name on file is the name used — the assistant did not have to ask.
    expect(model.requests[0]!.context).toContain("Name on file for this number: Amelia Hughes");
  });
});

describe("Scenario 5 — booking request", () => {
  test("the S-Class is requested, and lands in Bookings as pending with its car and customer", async () => {
    start([
      calls("record_journey_details", {
        name: "Amelia Hughes",
        vehicle: "S Class",
        pickup: "The Savoy",
        dropoff: "Kew Gardens",
        date: "2027-02-14",
        time: "19:00",
        passengers: 2,
      }),
      says("The S-Class from the Savoy on 14 February at 19:00 for two. Shall I send the request?"),
      calls("create_booking_request"),
      says("Your booking request is BKG-2100. The team will confirm the car and chauffeur."),
    ]);
    await customerSays("SM1", "I'd like to request the S Class from the Savoy to Kew on 14 Feb at 7pm, two of us. Amelia Hughes.");
    await customerSays("SM2", "Yes please");

    // Admin → Bookings.
    const booking = only(await rows("select * from booking"));
    expect(booking).toMatchObject({
      reference: "BKG-2100",
      status: "pending",
      vehicle_id: "veh-sclass",
      date: "2027-02-14",
      time: "19:00",
      pickup: "The Savoy",
      destination: "Kew Gardens",
      passengers: 2,
    });
    const customer = only(await rows(`select name from customer where id = '${booking.customer_id}'`));
    expect(customer.name).toBe("Amelia Hughes");

    // The office can see where it came from, and that nobody has confirmed it.
    const trail = only(await rows(`select text from activity_entry where booking_id = '${booking.id}'`));
    expect(String(trail.text)).toContain("WhatsApp");
    expect(String(trail.text)).toContain("not yet confirmed");
    expect(lastToolResult().data.reference).toBe("BKG-2100");
  });

  test("a booking request without a date is not made", async () => {
    start([
      calls("record_journey_details", { name: "Amelia Hughes", vehicle: "Cullinan", pickup: "Mayfair" }),
      calls("create_booking_request"),
      says("Which date would you like?"),
    ]);
    await customerSays("SM1", "Can I request the Cullinan from Mayfair?");

    expect(await rows("select id from booking")).toHaveLength(0);
    expect(lastToolResult().error.code).toBe("incomplete");
  });
});

describe("Scenario 6 — the same message twice", () => {
  test("one message, one run, one enquiry, one reply", async () => {
    start([
      calls("record_journey_details", { name: "Amelia Hughes", pickup: "Heathrow" }),
      calls("create_enquiry"),
      says("ENQ-1100 — the team will be in touch."),
    ]);
    const first = await customerSays("SM-DUP", "Heathrow please, Amelia Hughes, send it");
    const retry = await customerSays("SM-DUP", "Heathrow please, Amelia Hughes, send it");

    expect(first.runIds).toHaveLength(1);
    expect(retry.status).toBe(200);
    expect(retry.runIds).toHaveLength(0);
    expect(await rows("select id from whatsapp_message where direction = 'inbound'")).toHaveLength(1);
    expect(await rows("select id from whatsapp_agent_run")).toHaveLength(1);
    expect(await rows("select id from enquiry")).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });

  test("a run that is somehow run again finds the enquiry it already made", async () => {
    start([
      calls("record_journey_details", { name: "Amelia Hughes", pickup: "Heathrow" }),
      calls("create_enquiry"),
      says("ENQ-1100"),
    ]);
    await customerSays("SM1", "Heathrow please, Amelia Hughes");

    // Replay the same turn as a restart after a crash would: same triggering
    // message, so the same submission id.
    const backend = factories.createWhatsAppBackend();
    const again = await backend.createEnquiry({
      customer: { name: "Amelia Hughes", phone: AMELIA as E164, email: "" },
      journey: { service: "", vehicleId: null, pickup: "Heathrow", dropoff: "", date: "", time: "", passengers: null, luggage: "", flight: "", notes: "" },
      submissionId: only(await rows("select submission_id from enquiry")).submission_id as string,
    });
    expect(again.reference).toBe("ENQ-1100");
    expect(await rows("select id from enquiry")).toHaveLength(1);
  });
});

describe("Scenario 7 — a person", () => {
  test("asking for someone hands over, and the office can see it needs a person", async () => {
    start([says("this is never said")]);
    await customerSays("SM1", "I want to speak to someone.");

    expect(model.requests).toHaveLength(0);
    expect(lastReply()).toContain("member of the City Chauffeurs team");

    const conversation = only(await rows("select status, handoff_reason, handoff_summary from whatsapp_conversation"));
    expect(conversation).toMatchObject({ status: "human_requested", handoff_reason: "customer_asked" });
    expect(String(conversation.handoff_summary)).toContain("person");

    // Later messages wait for the person: recorded, never answered by the assistant.
    const later = await customerSays("SM2", "Hello?");
    expect(later.runIds).toHaveLength(0);
    expect(provider.sent).toHaveLength(1);
    expect(await rows("select id from whatsapp_message where direction = 'inbound'")).toHaveLength(2);
  });

  test("the office replies, and the reply is on the record as theirs", async () => {
    start([says("Hello!")]);
    await customerSays("SM1", "Hi");
    const conversation = only(await rows("select id from whatsapp_conversation"));

    const sent = await whatsapp.sendOperatorMessage(conversation.id as string, "Hi Amelia, this is Faheem.");
    expect(sent.ok).toBe(true);
    expect(only(await rows("select status from whatsapp_conversation")).status).toBe("human_active");
    const operator = only(await rows("select author, delivery from whatsapp_message where author = 'operator'"));
    expect(operator).toEqual({ author: "operator", delivery: "sent" });
  });
});

describe("validation the assistant cannot get round", () => {
  test("a date that does not exist never reaches the diary", async () => {
    start([
      calls("record_journey_details", { name: "Amelia Hughes", pickup: "Mayfair", date: "2027-02-31" }),
      calls("create_booking_request"),
      says("Which date?"),
    ]);
    await customerSays("SM1", "31 February please");

    expect(await rows("select id from booking")).toHaveLength(0);
  });

  test("another customer's enquiry cannot be looked up from this number", async () => {
    await database.client.exec(`
      insert into customer (id, name, type, company, phone, email, notes)
      values ('cus-other', 'Somebody Else', 'private', '', '07700 900999', '', '');
      insert into enquiry (id, reference, customer_id, contact, source, reply_by, journey, message, status)
      values ('enq-other', 'ENQ-4242', 'cus-other', '{"name":"Somebody Else","phone":"07700 900999","email":""}'::jsonb,
              'website', 'phone', '{}'::jsonb, '', 'new');
    `);
    start([calls("get_enquiry_status", { reference: "ENQ-4242" }), says("I can't find that one.")]);
    await customerSays("SM1", "What's happening with ENQ-4242?");

    expect(lastToolResult().error.code).toBe("not_found");
  });
});

describe("observability", () => {
  test("each run records its model, tool calls, tokens and time — but never the customer's words", async () => {
    start([calls("get_fleet"), says("We have two cars.")]);
    await customerSays("SM1", "What cars do you have?");

    const run = only(await rows("select * from whatsapp_agent_run"));
    expect(run).toMatchObject({ status: "succeeded", model: "scripted", iterations: 2 });
    expect(run.tool_calls).toEqual([expect.objectContaining({ name: "get_fleet", ok: true })]);
    expect(Number(run.input_tokens)).toBeGreaterThan(0);
    expect(run.reply_message_id).toBeTruthy();
    expect(JSON.stringify(run.tool_calls)).not.toContain("cars do you have");
  });
});
