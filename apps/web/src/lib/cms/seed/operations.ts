import type { ActivityEntry, Booking, Customer, Enquiry } from "../types";

/**
 * SAMPLE OPERATIONS DATA — not real customers.
 *
 * The website does not store enquiries yet (the form hands them to WhatsApp
 * or email), so there is no real pipeline to show. These records exist only
 * so the enquiry, booking and customer screens can be reviewed with
 * realistic content. Every admin screen that shows them says so.
 *
 *   · names are invented; companies are marked "Example"
 *   · phone numbers are in Ofcom's 07700 900xxx range, reserved for fiction
 *   · email addresses use example.com, which can never be delivered to
 *   · rates are consistent with the client's indicative rate card
 *
 * Dates are generated relative to the moment the data is first created, so
 * the dashboard reads naturally whenever it is opened.
 */

type Offset = { days?: number; hours?: number; minutes?: number };

function at(now: Date, offset: Offset) {
  const ms =
    (offset.days ?? 0) * 86_400_000 + (offset.hours ?? 0) * 3_600_000 + (offset.minutes ?? 0) * 60_000;
  return new Date(now.getTime() + ms).toISOString();
}

function day(now: Date, days: number) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function log(id: string, atISO: string, kind: ActivityEntry["kind"], text: string): ActivityEntry {
  return { id, at: atISO, kind, text };
}

export function buildSampleOperations(now = new Date()) {
  const customers: Customer[] = [
    ["cus-01", "James Anderson", "corporate", "Example Capital LLP", "07700 900101", "james.anderson@example.com", "Prefers the S-Class. Assistant sometimes books on his behalf.", -60],
    ["cus-02", "Sophie Clarke", "private", "", "07700 900102", "sophie.clarke@example.com", "", -1],
    ["cus-03", "Priya Shah", "corporate", "Example Advisory Ltd", "07700 900103", "priya.shah@example.com", "Executive assistant — coordinates roadshows for two partners.", -3],
    ["cus-04", "Oliver Bennett", "private", "", "07700 900104", "oliver.bennett@example.com", "", -2],
    ["cus-05", "Amelia Hughes", "event", "Example Events Co.", "07700 900105", "amelia@example.com", "Event planner. Books on behalf of clients.", -30],
    ["cus-06", "Daniel Morgan", "private", "", "07700 900106", "daniel.morgan@example.com", "", -40],
    ["cus-07", "Charlotte Reid", "private", "", "07700 900107", "charlotte.reid@example.com", "", -7],
    ["cus-08", "Marcus Lee", "corporate", "Example Partners", "07700 900108", "marcus.lee@example.com", "", -9],
    ["cus-09", "Hannah Walsh", "event", "", "07700 900109", "hannah.walsh@example.com", "", -11],
    ["cus-10", "Tom Fletcher", "private", "", "07700 900110", "tom.fletcher@example.com", "", -12],
    ["cus-11", "Grace Turner", "private", "", "07700 900111", "grace.turner@example.com", "Two children, 6 and 9 — booster seat for the younger.", -20],
  ].map(([id, name, type, company, phone, email, notes, created]) => ({
    id: id as string,
    name: name as string,
    type: type as Customer["type"],
    company: company as string,
    phone: phone as string,
    email: email as string,
    notes: notes as string,
    createdAt: at(now, { days: created as number, hours: -2 }),
    updatedAt: at(now, { days: created as number, hours: -2 }),
  }));

  const contactOf = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)!;
    return { name: customer.name, phone: customer.phone, email: customer.email };
  };

  type EnquirySpec = {
    id: string;
    customerId: string;
    created: Offset;
    status: Enquiry["status"];
    source: Enquiry["source"];
    replyBy: Enquiry["replyBy"];
    journey: Partial<Enquiry["journey"]> & { service: string };
    message: string;
    lostReason?: Enquiry["lostReason"];
    quote?: { amount: number; note: string; after: Offset };
    notes?: { body: string; after: Offset }[];
    history?: { after: Offset; text: string }[];
    bookingId?: string;
  };

  const enquirySpecs: EnquirySpec[] = [
    {
      id: "enq-1048",
      customerId: "cus-01",
      created: { minutes: -48 },
      status: "new",
      source: "website",
      replyBy: "whatsapp",
      journey: {
        service: "corporate",
        vehicleId: "s-class",
        pickup: "Canary Wharf, E14",
        dropoff: "Heathrow Terminal 5",
        date: day(now, 3),
        time: "07:15",
        passengers: 2,
        luggage: "2 cabin bags",
      },
      message: "Two of us flying to Zurich. Would like the S-Class again if it is free.",
    },
    {
      id: "enq-1047",
      customerId: "cus-02",
      created: { hours: -3, minutes: -20 },
      status: "new",
      source: "website",
      replyBy: "email",
      journey: {
        service: "weddings",
        vehicleId: "cullinan",
        pickup: "The Langham, Marylebone",
        dropoff: "St Marylebone Parish Church",
        date: day(now, 280),
        time: "13:30",
        passengers: 2,
      },
      message:
        "Looking for the Cullinan as the principal car, and two further cars for parents and bridesmaids. Reception is at the same hotel afterwards.",
    },
    {
      id: "enq-1046",
      customerId: "cus-04",
      created: { hours: -26 },
      status: "new",
      source: "phone",
      replyBy: "phone",
      journey: {
        service: "private-chauffeur",
        vehicleId: null,
        pickup: "Chelsea, SW3",
        dropoff: "As directed — Mayfair appointments",
        date: day(now, 6),
        time: "10:00",
        passengers: 1,
      },
      message: "Needs a car for the day, roughly six hours. Called the office — asked for a call back.",
    },
    {
      id: "enq-1045",
      customerId: "cus-03",
      created: { days: -2, hours: -4 },
      status: "contacted",
      source: "email",
      replyBy: "email",
      journey: {
        service: "roadshows",
        vehicleId: "v-class-jet",
        pickup: "Mayfair, W1",
        dropoff: "Manchester, Leeds, Edinburgh",
        date: day(now, 21),
        time: "08:00",
        passengers: 3,
        luggage: "3 cases",
      },
      message: "Three-day investor roadshow for two partners and an analyst. Draft itinerary attached to the email.",
      notes: [{ body: "Spoke to Priya — final itinerary due Friday. Wants one chauffeur for all three days.", after: { hours: 5 } }],
      history: [{ after: { hours: 5 }, text: "Status changed to Contacted" }],
    },
    {
      id: "enq-1044",
      customerId: "cus-05",
      created: { days: -4, hours: -1 },
      status: "quoted",
      source: "website",
      replyBy: "email",
      journey: {
        service: "events",
        vehicleId: "g-wagon",
        pickup: "Knightsbridge, SW1",
        dropoff: "Private venue, Kensington",
        date: day(now, 12),
        time: "18:00",
        passengers: 9,
      },
      message: "Evening event for a client — six hours, cars held on site. G-Wagon for the host and a V-Class for guests.",
      quote: { amount: 1200, note: "G-Wagon 6 h (£750) and V-Class 6 h (£450). Surcharges extra if applicable.", after: { hours: 20 } },
      history: [
        { after: { hours: 3 }, text: "Status changed to Contacted" },
        { after: { hours: 20 }, text: "Quote recorded — £1,200" },
      ],
    },
    {
      id: "enq-1043",
      customerId: "cus-06",
      created: { days: -5, hours: -3 },
      status: "won",
      source: "whatsapp",
      replyBy: "whatsapp",
      journey: {
        service: "airport-transfers",
        vehicleId: "s-class",
        pickup: "Heathrow Terminal 3",
        dropoff: "Chelsea, SW10",
        date: day(now, 2),
        time: "06:45",
        passengers: 2,
        luggage: "2 large cases",
        flight: "BA 178",
      },
      message: "Landing from New York early morning.",
      quote: { amount: 360, note: "Four-hour minimum at £90. Airport parking added at cost.", after: { hours: 2 } },
      history: [
        { after: { hours: 1 }, text: "Status changed to Contacted" },
        { after: { hours: 2 }, text: "Quote recorded — £360" },
        { after: { days: 1 }, text: "Status changed to Won" },
        { after: { days: 1, minutes: 5 }, text: "Booking BKG-2019 created" },
      ],
      bookingId: "bkg-2019",
    },
    {
      id: "enq-1042",
      customerId: "cus-07",
      created: { days: -6, hours: -2 },
      status: "quoted",
      source: "website",
      replyBy: "whatsapp",
      journey: {
        service: "weddings",
        vehicleId: "ghost",
        pickup: "Richmond, TW10",
        dropoff: "Syon Park, Brentford",
        date: day(now, 190),
        time: "12:00",
        passengers: 2,
      },
      message: "Ghost for the bride and her father, and a V-Class for the bridesmaids.",
      quote: { amount: 1450, note: "Bespoke wedding quote — principal car and one support vehicle, ribbons included.", after: { days: 1 } },
      history: [
        { after: { hours: 6 }, text: "Status changed to Contacted" },
        { after: { days: 1 }, text: "Quote recorded — £1,450" },
      ],
      notes: [{ body: "Visiting the venue next week — will confirm timings after.", after: { days: 2 } }],
    },
    {
      id: "enq-1041",
      customerId: "cus-08",
      created: { days: -8 },
      status: "won",
      source: "email",
      replyBy: "email",
      journey: {
        service: "corporate",
        vehicleId: "s-class",
        pickup: "Mayfair, W1",
        dropoff: "Canary Wharf — as directed",
        date: day(now, 1),
        time: "08:00",
        passengers: 1,
      },
      message: "Full day of client meetings between Mayfair and Canary Wharf.",
      quote: { amount: 720, note: "Eight hours at £90.", after: { hours: 4 } },
      history: [
        { after: { hours: 4 }, text: "Quote recorded — £720" },
        { after: { days: 1 }, text: "Status changed to Won" },
        { after: { days: 1, minutes: 2 }, text: "Booking BKG-2018 created" },
      ],
      bookingId: "bkg-2018",
    },
    {
      id: "enq-1040",
      customerId: "cus-09",
      created: { days: -10 },
      status: "lost",
      source: "website",
      replyBy: "email",
      lostReason: "availability",
      journey: {
        service: "events",
        vehicleId: "cullinan",
        pickup: "Shoreditch, E1",
        dropoff: "Hampton Court",
        date: day(now, -3),
        time: "17:00",
        passengers: 4,
      },
      message: "Anniversary dinner — would love the Cullinan.",
      history: [
        { after: { hours: 2 }, text: "Status changed to Contacted" },
        { after: { hours: 3 }, text: "Status changed to Lost — Availability" },
      ],
    },
    {
      id: "enq-1039",
      customerId: "cus-10",
      created: { days: -12 },
      status: "lost",
      source: "website",
      replyBy: "phone",
      lostReason: "price",
      journey: {
        service: "supercar-hire",
        vehicleId: "huracan",
        pickup: "Fulham, SW6",
        dropoff: "",
        date: day(now, -5),
        time: "09:00",
        passengers: 2,
      },
      message: "Self-drive for a weekend, birthday present.",
      quote: { amount: 1800, note: "Weekend self-drive, subject to eligibility and insurance.", after: { hours: 6 } },
      history: [
        { after: { hours: 6 }, text: "Quote recorded — £1,800" },
        { after: { days: 2 }, text: "Status changed to Lost — Price" },
      ],
    },
    {
      id: "enq-1038",
      customerId: "cus-01",
      created: { days: -14 },
      status: "won",
      source: "whatsapp",
      replyBy: "whatsapp",
      journey: {
        service: "airport-transfers",
        vehicleId: "s-class",
        pickup: "Heathrow Terminal 5",
        dropoff: "Canary Wharf, E14",
        date: day(now, -3),
        time: "16:20",
        passengers: 1,
        flight: "LX 332",
      },
      message: "Return from Zurich.",
      quote: { amount: 360, note: "Four-hour minimum at £90.", after: { hours: 1 } },
      history: [
        { after: { hours: 1 }, text: "Quote recorded — £360" },
        { after: { hours: 2 }, text: "Status changed to Won" },
        { after: { hours: 2, minutes: 3 }, text: "Booking BKG-2017 created" },
      ],
      bookingId: "bkg-2017",
    },
    {
      id: "enq-1037",
      customerId: "cus-11",
      created: { days: -20 },
      status: "contacted",
      source: "referral",
      replyBy: "phone",
      journey: {
        service: "school-family",
        vehicleId: "range-rover",
        pickup: "Kensington, W8",
        dropoff: "School, Holland Park",
        date: day(now, 5),
        time: "07:30",
        passengers: 3,
      },
      message: "Standing term-time school run, mornings only. Referred by a neighbour.",
      notes: [{ body: "Needs one Isofix booster. Sending term dates by email.", after: { days: 1 } }],
      history: [{ after: { days: 1 }, text: "Status changed to Contacted" }],
    },
  ];

  const enquiries: Enquiry[] = enquirySpecs.map((spec) => {
    const created = new Date(at(now, spec.created));
    const after = (offset: Offset) => at(created, offset);
    const activity: ActivityEntry[] = [
      log(`${spec.id}-a0`, created.toISOString(), "created", `Enquiry received via ${spec.source}`),
      ...(spec.history ?? []).map((entry, i) =>
        log(`${spec.id}-a${i + 1}`, after(entry.after), entry.text.startsWith("Quote") ? "quote" : entry.text.startsWith("Booking") ? "booking" : "status", entry.text),
      ),
    ];
    const notes = (spec.notes ?? []).map((note, i) => ({
      id: `${spec.id}-n${i}`,
      body: note.body,
      author: "Faheem",
      createdAt: after(note.after),
    }));
    const updatedAt = [...activity.map((entry) => entry.at), ...notes.map((note) => note.createdAt)].sort().at(-1)!;

    return {
      id: spec.id,
      reference: spec.id.toUpperCase(),
      customerId: spec.customerId,
      contact: contactOf(spec.customerId),
      source: spec.source,
      replyBy: spec.replyBy,
      journey: {
        vehicleId: null,
        pickup: "",
        dropoff: "",
        date: "",
        time: "",
        passengers: null,
        luggage: "",
        flight: "",
        ...spec.journey,
      },
      message: spec.message,
      status: spec.status,
      lostReason: spec.lostReason ?? null,
      quote: spec.quote
        ? { amount: spec.quote.amount, note: spec.quote.note, recordedAt: after(spec.quote.after) }
        : null,
      notes,
      activity,
      bookingId: spec.bookingId ?? null,
      createdAt: created.toISOString(),
      updatedAt,
    };
  });

  type BookingSpec = Omit<Booking, "reference" | "activity" | "createdAt" | "updatedAt" | "notes"> & {
    notes?: string;
    created: Offset;
  };

  const bookingSpecs: BookingSpec[] = [
    {
      id: "bkg-2023",
      customerId: "cus-01",
      enquiryId: null,
      service: "corporate",
      vehicleId: "s-class",
      date: day(now, 0),
      time: "09:00",
      pickup: "Canary Wharf, E14",
      destination: "Mayfair — as directed",
      passengers: 1,
      status: "in-progress",
      notes: "Booked by phone. Returns to Canary Wharf around 15:00.",
      created: { days: -4 },
    },
    {
      id: "bkg-2018",
      customerId: "cus-08",
      enquiryId: "enq-1041",
      service: "corporate",
      vehicleId: "s-class",
      date: day(now, 1),
      time: "08:00",
      pickup: "Mayfair, W1",
      destination: "Canary Wharf — as directed",
      passengers: 1,
      status: "confirmed",
      created: { days: -7 },
    },
    {
      id: "bkg-2019",
      customerId: "cus-06",
      enquiryId: "enq-1043",
      service: "airport-transfers",
      vehicleId: "s-class",
      date: day(now, 2),
      time: "06:45",
      pickup: "Heathrow Terminal 3 — BA 178",
      destination: "Chelsea, SW10",
      passengers: 2,
      status: "confirmed",
      notes: "Meet & greet in arrivals. Two large cases.",
      created: { days: -4 },
    },
    {
      id: "bkg-2021",
      customerId: "cus-11",
      enquiryId: null,
      service: "school-family",
      vehicleId: "range-rover",
      date: day(now, 5),
      time: "07:30",
      pickup: "Kensington, W8",
      destination: "School, Holland Park",
      passengers: 3,
      status: "pending",
      notes: "First run of a term-time arrangement, pending term dates. One Isofix booster.",
      created: { days: -1 },
    },
    {
      id: "bkg-2020",
      customerId: "cus-04",
      enquiryId: null,
      service: "private-chauffeur",
      vehicleId: "range-rover",
      date: day(now, 9),
      time: "19:00",
      pickup: "Chelsea, SW3",
      destination: "The Savoy, Strand",
      passengers: 2,
      status: "cancelled",
      notes: "Cancelled by the customer — plans changed.",
      created: { days: -15 },
    },
    {
      id: "bkg-2017",
      customerId: "cus-01",
      enquiryId: "enq-1038",
      service: "airport-transfers",
      vehicleId: "s-class",
      date: day(now, -3),
      time: "16:20",
      pickup: "Heathrow Terminal 5 — LX 332",
      destination: "Canary Wharf, E14",
      passengers: 1,
      status: "completed",
      created: { days: -14 },
    },
    {
      id: "bkg-2014",
      customerId: "cus-06",
      enquiryId: null,
      service: "tours",
      vehicleId: "cullinan",
      date: day(now, -20),
      time: "11:00",
      pickup: "Chelsea, SW10",
      destination: "Windsor — day trip",
      passengers: 3,
      status: "completed",
      created: { days: -35 },
    },
  ];

  const statusText: Record<Booking["status"], string> = {
    pending: "Booking created — pending",
    confirmed: "Status changed to Confirmed",
    "in-progress": "Status changed to In progress",
    completed: "Status changed to Completed",
    cancelled: "Status changed to Cancelled",
  };

  const bookings: Booking[] = bookingSpecs.map(({ created: offset, notes, ...spec }) => {
    const created = at(now, offset);
    // A journey starts and finishes on its own date; anything else changes
    // status the day after the booking was made.
    const onTheDay = new Date(`${spec.date}T${spec.time}:00`);
    const changed =
      spec.status === "in-progress"
        ? onTheDay.toISOString()
        : spec.status === "completed"
          ? at(onTheDay, { hours: 4 })
          : at(now, { days: (offset.days ?? 0) + 1 });
    const activity = [log(`${spec.id}-a0`, created, "created", "Booking created")];
    if (spec.status !== "pending") activity.push(log(`${spec.id}-a1`, changed, "status", statusText[spec.status]));
    return {
      ...spec,
      reference: spec.id.toUpperCase(),
      notes: notes ?? "",
      activity,
      createdAt: created,
      updatedAt: activity.at(-1)!.at,
    };
  });

  return { customers, enquiries, bookings };
}
