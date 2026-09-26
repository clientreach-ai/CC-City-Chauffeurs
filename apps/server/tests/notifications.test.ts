/**
 * Telling somebody, tested against a mailer that records instead of sends.
 *
 * Two things matter here and neither is the wording. That the office is told
 * at all — from the website and from WhatsApp alike, since an enquiry nobody
 * sees is the thing that made a request feel slow — and that the telling can
 * fail without costing the client the record it was telling them about.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let operations: typeof import("../src/repositories/operations");
let notifications: typeof import("../src/lib/notifications");
let mail: typeof import("../src/lib/mail");
let post: InstanceType<typeof import("../src/lib/mail").MemoryMailer>;

beforeAll(async () => {
  database = await startDatabase();
  operations = await import("../src/repositories/operations");
  notifications = await import("../src/lib/notifications");
  mail = await import("../src/lib/mail");
}, 60_000);

afterAll(async () => {
  mail.useMailer(null);
  await database.stop();
});

beforeEach(async () => {
  await database.reset();
  post = new mail.MemoryMailer();
  mail.useMailer(post);
}, 30_000);

afterEach(() => {
  post.clear();
});

/** The alerts are sent after the response, so a test has to let that happen. */
async function delivered(count = 1, ms = 2_000) {
  const until = Date.now() + ms;
  while (post.sent.length < count && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return post.sent;
}

const visitor = {
  name: "Amelia Hughes",
  phone: "07700 900321",
  email: "amelia@example.com",
  submissionId: "",
  replyBy: "email" as const,
  service: "airport-transfers",
  vehicleId: null,
  pickup: "Heathrow",
  dropoff: "Mayfair",
  date: "2027-01-11",
  time: "20:00",
  passengers: 3,
  luggage: "Two cases",
  flight: "BA117",
  message: "Meet and greet, please.",
  // The honeypot, empty as a real visitor leaves it.
  website: "",
};

describe("an enquiry the office has not seen yet", () => {
  test("is put in front of them, with everything needed to answer it", async () => {
    const enquiry = await operations.createPublicEnquiry(visitor);
    notifications.enquiryRecorded(enquiry);

    const [sent] = await delivered();
    expect(sent!.to).toBe("office@citychauffeurs.example");
    expect(sent!.subject).toBe(`${enquiry.reference} — enquiry from Amelia Hughes`);
    for (const detail of ["Heathrow", "Mayfair", "07700 900321", "amelia@example.com", "2027-01-11", "BA117"]) {
      expect(sent!.text).toContain(detail);
    }
    // A link straight to the record, and the customer's own words.
    expect(sent!.text).toContain(`https://admin.example/enquiries/${enquiry.id}`);
    expect(sent!.text).toContain("Meet and greet, please.");
    // Replying to the alert writes to the customer.
    expect(sent!.replyTo).toBe("amelia@example.com");
  });

  test("says plainly that the customer has been told nothing", async () => {
    notifications.enquiryRecorded(await operations.createPublicEnquiry(visitor));

    expect((await delivered())[0]!.text).toContain("Nothing has been sent to the customer.");
  });

  test("from WhatsApp reads as coming from WhatsApp", async () => {
    const enquiry = await operations.createPublicEnquiry(
      { ...visitor, email: "", submissionId: "wa:wam-1:enquiry" },
      { source: "whatsapp" },
    );
    notifications.enquiryRecorded(enquiry);

    const [sent] = await delivered();
    expect(sent!.text).toContain("sent an enquiry from WhatsApp");
    // No address to reply to: the assistant is already answering them there.
    expect(sent!.replyTo).toBeUndefined();
  });

  test("names the car the customer asked for", async () => {
    await database.client.exec(`
      insert into vehicle (id, slug, name, make, model, status, specs)
      values ('veh-ghost', 'ghost', 'Rolls-Royce Ghost', 'Rolls-Royce', 'Ghost', 'published',
              '{"passengers":3,"luggage":"","year":null,"transmission":"","bodyType":""}'::jsonb);
    `);
    notifications.enquiryRecorded(await operations.createPublicEnquiry({ ...visitor, vehicleId: "veh-ghost" }));

    expect((await delivered())[0]!.text).toContain("Rolls-Royce Ghost");
  });
});

describe("a booking the customer asked for", () => {
  const request = {
    name: "Amelia Hughes",
    phone: "07700 900321",
    email: "amelia@example.com",
    service: "",
    vehicleId: null,
    date: "2027-02-14",
    time: "19:00",
    pickup: "The Savoy",
    dropoff: "Kew",
    passengers: 2,
    notes: "",
    status: "pending" as const,
  };

  test("is put in front of the office as a request, not a booking", async () => {
    const booking = await operations.createBooking(request, {
      request: { channel: "whatsapp", submissionId: "wa:wam-2:booking" },
    });
    notifications.bookingRequested(booking, { name: request.name, phone: request.phone, email: request.email });

    const [sent] = await delivered();
    expect(sent!.subject).toBe(`${booking.reference} — booking request from Amelia Hughes`);
    expect(sent!.text).toContain("Nothing is confirmed until the office confirms it.");
    expect(sent!.text).toContain("The Savoy");
    expect(sent!.text).toContain(`https://admin.example/bookings/${booking.id}`);
  });
});

describe("the customer's confirmation", () => {
  test("goes to them once a person has confirmed it", async () => {
    const booking = await operations.createBooking({
      name: "Amelia Hughes",
      phone: "07700 900321",
      email: "amelia@example.com",
      service: "",
      vehicleId: null,
      date: "2027-02-14",
      time: "19:00",
      pickup: "The Savoy",
      dropoff: "Kew",
      passengers: 2,
      notes: "",
      status: "pending",
    });
    notifications.bookingConfirmed(booking, { name: "Amelia Hughes", email: "amelia@example.com" });

    const [sent] = await delivered();
    expect(sent!.to).toBe("amelia@example.com");
    expect(sent!.subject).toBe(`Your chauffeur is confirmed — ${booking.reference}`);
    expect(sent!.text).toContain("Your chauffeur is confirmed.");
    expect(sent!.text).toContain("The Savoy");
    // Replies reach the office, not a mailbox nobody reads.
    expect(sent!.replyTo).toBe("office@citychauffeurs.example");
  });

  test("is not attempted for a customer who never gave an address", async () => {
    const booking = await operations.createBooking({
      name: "Amelia Hughes",
      phone: "07700 900321",
      email: "",
      service: "",
      vehicleId: null,
      date: "2027-02-14",
      time: "19:00",
      pickup: "The Savoy",
      dropoff: "Kew",
      passengers: null,
      notes: "",
      status: "pending",
    });
    notifications.bookingConfirmed(booking, { name: "Amelia Hughes", email: "" });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(post.sent).toEqual([]);
  });
});

describe("a customer waiting for a person", () => {
  const waiting = {
    conversationId: "wac-1",
    phone: "+447700900321",
    customerName: "Amelia Hughes",
    profileName: "Amelia",
    reason: "customer_asked",
    summary: "She would rather speak to somebody about a wedding car.",
    lastMessage: "Could I speak to someone please?",
  };

  test("is put in front of the office, with why, what they said, and where to answer", async () => {
    notifications.conversationNeedsAPerson(waiting);

    const [sent] = await delivered();
    expect(sent!.to).toBe("office@citychauffeurs.example");
    expect(sent!.subject).toBe("WhatsApp: Amelia Hughes is waiting for a person");
    expect(sent!.text).toContain("They asked for a person");
    expect(sent!.text).toContain("+447700900321");
    expect(sent!.text).toContain("She would rather speak to somebody about a wedding car.");
    expect(sent!.text).toContain("Could I speak to someone please?");
    expect(sent!.text).toContain("https://admin.example/whatsapp/wac-1");
    // So nobody waits for the assistant to pick it back up by itself.
    expect(sent!.text).toContain("will not answer again until the conversation is handed back");
  });

  test("is named by whatever we know them as", async () => {
    notifications.conversationNeedsAPerson({ ...waiting, customerName: null });
    expect((await delivered())[0]!.subject).toBe("WhatsApp: Amelia is waiting for a person");

    post.clear();
    notifications.conversationNeedsAPerson({ ...waiting, customerName: null, profileName: null });
    expect((await delivered())[0]!.subject).toBe("WhatsApp: +447700900321 is waiting for a person");
  });

  test("reads properly whatever the assistant handed over for", async () => {
    notifications.conversationNeedsAPerson({ ...waiting, reason: "complaint" });
    expect((await delivered())[0]!.text).toContain("A complaint");

    post.clear();
    notifications.conversationNeedsAPerson({ ...waiting, reason: "urgent" });
    expect((await delivered())[0]!.text).toContain("Something urgent");
  });
});

describe("when the post cannot go out", () => {
  test("the enquiry is still recorded, and the failure is only a failure to tell", async () => {
    post.failNext({ ok: false, code: "smtp_econnrefused", detail: "connect ECONNREFUSED" });

    const enquiry = await operations.createPublicEnquiry(visitor);
    notifications.enquiryRecorded(enquiry);
    await delivered();

    // The record — the thing that matters — is untouched by the mail server.
    const rows = (await database.client.query("select reference, status from enquiry")).rows as Record<string, unknown>[];
    expect(only(rows)).toMatchObject({ reference: enquiry.reference, status: "new" });
  });

  test("a mailer that throws is not allowed to take the process with it", async () => {
    mail.useMailer({
      name: "broken",
      send: async () => {
        throw new Error("the transport exploded");
      },
    });

    const enquiry = await operations.createPublicEnquiry(visitor);
    expect(() => notifications.enquiryRecorded(enquiry)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect((await database.client.query("select reference from enquiry")).rows).toHaveLength(1);
  });
});

describe("with email switched off", () => {
  test("the mailer agrees and sends nothing — which is what every deployment does by default", async () => {
    const silent = new mail.SilentMailer();

    expect(silent.name).toBe("off");
    expect(await silent.send({ to: "anybody@example.com", subject: "x", text: "x" })).toEqual({ ok: true, id: null });
  });

  test("and that is the mailer the environment builds when nothing is configured", () => {
    mail.useMailer(null);
    expect(mail.mailer().name).toBe("off");
    mail.useMailer(post);
  });
});
