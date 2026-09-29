/**
 * The checks on the finished reply, which do not depend on the model
 * behaving. Each one is a promise the business would have to keep.
 */

import { describe, expect, test } from "bun:test";

import { checkReply } from "../src/agent/reply";

const nothingCreated = { created: null, references: [] };

describe("a reference the customer is given", () => {
  test("is added when the model forgot it", () => {
    const checked = checkReply("Thank you, that is with the team now.", {
      created: { kind: "enquiry", reference: "ENQ-1100" },
      references: ["ENQ-1100"],
    });

    expect(checked.text).toBe("Thank you, that is with the team now. Your reference is ENQ-1100.");
    expect(checked.corrections).toEqual(["reference_appended"]);
  });

  test("is left alone when the model already gave the right one", () => {
    const reply = "Your enquiry is ENQ-1100, and the team will be in touch.";
    const checked = checkReply(reply, { created: { kind: "enquiry", reference: "ENQ-1100" }, references: ["ENQ-1100"] });

    expect(checked.text).toBe(reply);
    expect(checked.corrections).toEqual([]);
  });

  test("is the real one, when the model quoted a number of its own", () => {
    const checked = checkReply("All done, your reference is ENQ-4242.", {
      created: { kind: "enquiry", reference: "ENQ-1100" },
      references: ["ENQ-1100"],
    });

    expect(checked.text).toBe("All done, your reference is ENQ-1100.");
    expect(checked.text).not.toContain("4242");
    expect(checked.corrections).toEqual(["invented_reference_replaced"]);
  });

  test("is never a number invented out of nothing", () => {
    const checked = checkReply("Your booking BKG-9999 is all set.", nothingCreated);

    // Nothing was created, so there is nothing it could have meant: the whole
    // reply goes rather than send the customer a number to quote.
    expect(checked.text).not.toContain("BKG-9999");
    expect(checked.text).toContain("someone will reply to you here");
    expect(checked.corrections).toEqual(["invented_reference_dropped"]);
  });

  test("may be one given earlier in the same conversation", () => {
    const reply = "Your earlier enquiry ENQ-1100 is still with the team.";
    const checked = checkReply(reply, { created: null, references: ["ENQ-1100"] });

    expect(checked.text).toBe(reply);
    expect(checked.corrections).toEqual([]);
  });

  test("is matched however the model wrote it", () => {
    const checked = checkReply("Your reference is enq-1100.", {
      created: { kind: "enquiry", reference: "ENQ-1100" },
      references: [],
    });

    // Already there, in the customer's own reading: nothing is appended twice.
    expect(checked.text).toBe("Your reference is enq-1100.");
    expect(checked.corrections).toEqual([]);
  });
});

describe("an enquiry the customer might read as a booking", () => {
  test("cannot go out sounding confirmed", () => {
    const checked = checkReply("Your Rolls-Royce is booked for the 14th. Reference ENQ-2100.", {
      created: { kind: "enquiry", reference: "ENQ-2100" },
      references: ["ENQ-2100"],
    });

    expect(checked.text).toContain("rather than a confirmed booking");
    expect(checked.corrections).toContain("booking_not_confirmed_added");
  });

  test("worded properly is left as it is", () => {
    const reply = "I have passed your request to the team, who will confirm it here. Reference ENQ-2100.";
    const checked = checkReply(reply, { created: { kind: "enquiry", reference: "ENQ-2100" }, references: [] });

    expect(checked.text).toBe(reply);
    expect(checked.corrections).toEqual([]);
  });

  test("the note is added once, not once a word", () => {
    const checked = checkReply("Booked and reserved and secured. ENQ-2100", {
      created: { kind: "enquiry", reference: "ENQ-2100" },
      references: [],
    });

    expect(checked.text.match(/This is an enquiry/g)).toHaveLength(1);
  });

  test("an enquiry is not lectured about confirmation", () => {
    const checked = checkReply("Your enquiry ENQ-1100 is confirmed as received.", {
      created: { kind: "enquiry", reference: "ENQ-1100" },
      references: [],
    });

    expect(checked.text).not.toContain("This is a request");
  });
});

describe("an ordinary reply", () => {
  for (const reply of [
    "We have the Mercedes S-Class and the Rolls-Royce Cullinan.",
    "How many passengers will there be?",
  ]) {
    test(`"${reply.slice(0, 40)}…" goes out exactly as written`, () => {
      expect(checkReply(reply, nothingCreated)).toEqual({ text: reply, corrections: [] });
    });
  }
});

describe("a price the customer is told", () => {
  /** As the tools returned them: the Cullinan at £200, a £500 day rate in a note. */
  const shown = { created: null, references: [], figures: [200, 500] };

  test("a rate the client published goes out as written", () => {
    const reply = "From £200 an hour as a guide, and the team confirms the price.";

    expect(checkReply(reply, shown)).toEqual({ text: reply, corrections: [] });
  });

  test("a figure written into the client's own note goes out too", () => {
    const reply = "Day rates start from £500, and the team confirm it once they know the journey.";

    expect(checkReply(reply, shown)).toEqual({ text: reply, corrections: [] });
  });

  test("£1,200 reads as 1200, whichever way it is written", () => {
    expect(checkReply("That would be £1,200 for the day.", { ...shown, figures: [1200] }).corrections).toEqual([]);
  });

  test("a figure nothing gave it never reaches the customer", () => {
    const checked = checkReply("The Huracán is around £180 an hour.", shown);

    expect(checked.text).not.toContain("180");
    expect(checked.text).toContain("the City Chauffeurs team will come back to you with the figure");
    expect(checked.corrections).toContain("invented_price_dropped");
  });

  test("a price is blocked when the tools showed none at all", () => {
    const checked = checkReply("It is about £90 an hour.", nothingCreated);

    expect(checked.corrections).toContain("invented_price_dropped");
  });

  test("a car with no published rate is talked about without a number", () => {
    const reply = "The Revuelto is on request. Tell me the date and the team will come back with a figure.";

    expect(checkReply(reply, shown)).toEqual({ text: reply, corrections: [] });
  });

  test("a price written in words is caught the same way", () => {
    for (const reply of ["It is about 180 pounds an hour.", "Roughly GBP 180.", "About 180 quid."]) {
      expect(checkReply(reply, shown).corrections, reply).toContain("invented_price_dropped");
    }

    expect(checkReply("The Cullinan is 200 pounds an hour as a guide.", shown).corrections).toEqual([]);
  });

  test("a number that is not money is left alone", () => {
    const reply = "The S-Class seats 3, with 2 large cases, and there is a 4 hour minimum.";

    expect(checkReply(reply, nothingCreated)).toEqual({ text: reply, corrections: [] });
  });
});

describe("the dash a person would not type", () => {
  test("an em dash between clauses becomes a comma", () => {
    const checked = checkReply("The S-Class seats three — the team will confirm the price.", nothingCreated);

    expect(checked.text).toBe("The S-Class seats three, the team will confirm the price.");
    expect(checked.corrections).toEqual(["dashes_replaced"]);
  });

  for (const [written, expected] of [
    ["Heathrow to Mayfair – one large case.", "Heathrow to Mayfair, one large case."],
    ["I can take the details - the office confirms them.", "I can take the details, the office confirms them."],
    ["Two cars are free—both are saloons.", "Two cars are free, both are saloons."],
  ] as const) {
    test(`"${written.slice(0, 32)}…" is rewritten`, () => {
      expect(checkReply(written, nothingCreated).text).toBe(expected);
    });
  }

  test("a reference, a hyphenated name and a range keep their hyphens", () => {
    const reply = "Your reference is ENQ-1100. The S-Class and the V-Class seat 3-6 between them.";

    expect(checkReply(reply, { created: null, references: ["ENQ-1100"] })).toEqual({ text: reply, corrections: [] });
  });

  test("a list written with dashes is left as a list", () => {
    const reply = "We have:\n- Mercedes S-Class\n- Rolls-Royce Cullinan";

    expect(checkReply(reply, nothingCreated)).toEqual({ text: reply, corrections: [] });
  });

  test("nothing our own replies say has one in it", async () => {
    const guardrails = await import("../src/agent/guardrails");
    for (const [name, sentence] of Object.entries(guardrails)) {
      if (typeof sentence !== "string") continue;
      expect(sentence, `${name} should read as something a person typed`).not.toMatch(/[—–]| - /);
    }
  });

  // The check's own sentences are added after the rewriting has run, so a
  // dash in one of them would go out exactly as written.
  test("nor the sentences the check itself adds", () => {
    const dropped = checkReply("Your reference is ENQ-9999.", nothingCreated);
    const booking = checkReply("Your car is booked for Friday. Reference ENQ-2100.", {
      created: { kind: "enquiry", reference: "ENQ-2100" },
      references: [],
    });

    expect(dropped.corrections).toContain("invented_reference_dropped");
    expect(dropped.text).not.toMatch(/[—–]| - /);
    expect(booking.corrections).toContain("booking_not_confirmed_added");
    expect(booking.text).not.toMatch(/[—–]| - /);
  });
});
