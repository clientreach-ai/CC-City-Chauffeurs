/**
 * The checks on the finished reply, which do not depend on the model
 * behaving. Each one is a promise the business would have to keep.
 */

import { describe, expect, test } from "bun:test";

import { checkReply, figuresIn } from "../src/agent/reply";

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
    // The point is that the comma form is recognised as the figure the tools
    // gave, so it is not dropped as invented. Stated bare it does also pick
    // up the sentence saying it is a guide, which is the next test's job.
    const checked = checkReply("That would be £1,200 for the day.", { ...shown, figures: [1200] });
    expect(checked.corrections).not.toContain("invented_price_dropped");
    expect(checked.text).toContain("£1,200");
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

  test("a quote the office recorded on their own enquiry may be repeated", () => {
    const shown = figuresIn(JSON.stringify({ ok: true, data: { reference: "ENQ-1100", quote: { amount: 450, note: "" } } }));
    expect(shown).toEqual([450]);
    // Passed as the office's own figure, which is what the caller does. It
    // is an answer rather than a starting rate, so it is repeated exactly
    // and never softened into "a guide".
    const checked = checkReply("The office has put £450 against it.", {
      ...nothingCreated,
      references: [],
      figures: shown,
      quoted: shown,
    });
    expect(checked.corrections).toEqual([]);
    expect(checked.text).toBe("The office has put £450 against it.");
  });

  test("a published rate stated bare is said to be a guide", () => {
    const checked = checkReply("The Cullinan is £200 an hour.", { ...nothingCreated, references: [], figures: [200] });
    expect(checked.text).toContain("£200");
    expect(checked.text).toContain("a guide rather than a final figure");
    expect(checked.corrections).toContain("guide_framing_added");
  });

  test("a rate already framed as a guide is left exactly as written", () => {
    for (const reply of [
      "The Cullinan is from £200 an hour as a guide.",
      "Day rates start from £500.",
      "It would be around £200 an hour.",
    ]) {
      const checked = checkReply(reply, { ...nothingCreated, references: [], figures: [200, 500] });
      expect(checked.corrections).not.toContain("guide_framing_added");
      expect(checked.text).toBe(reply);
    }
  });

  test("a discount the assistant has no authority to give never goes out", () => {
    const checked = checkReply("I can do you a 10% off the price for that one.", {
      ...nothingCreated,
      references: [],
      figures: [],
    });
    expect(checked.text).not.toContain("10%");
    expect(checked.text).toContain("pass that to the team");
    expect(checked.corrections).toContain("discount_offer_dropped");
  });

  test("saying plainly that there is no discount is left alone", () => {
    for (const reply of [
      "I can't offer a discount myself, the team would have to.",
      "That isn't something I can discount, I'm afraid.",
    ]) {
      const checked = checkReply(reply, { ...nothingCreated, references: [], figures: [] });
      expect(checked.corrections).not.toContain("discount_offer_dropped");
      expect(checked.text).toBe(reply);
    }
  });

  test("naming the office does not make a discount acceptable", () => {
    const checked = checkReply("The team have agreed 10% off for you.", {
      ...nothingCreated,
      references: [],
      figures: [],
    });
    expect(checked.text).not.toContain("10%");
    expect(checked.corrections).toContain("discount_offer_dropped");
  });

  test("only the sentence offering a discount goes, not the useful half", () => {
    const checked = checkReply("The Ghost seats three. I could knock some off for you.", {
      ...nothingCreated,
      references: [],
      figures: [],
    });
    expect(checked.text).toContain("The Ghost seats three.");
    expect(checked.text).toContain("pass that to the team");
  });

  test("a price taken out still leaves the reference of what was recorded", () => {
    const checked = checkReply("That will be about £300. Your reference is ENQ-1102.", {
      created: { kind: "enquiry", reference: "ENQ-1102" },
      references: ["ENQ-1102"],
      figures: [],
    });

    expect(checked.corrections).toContain("invented_price_dropped");
    expect(checked.text).toContain("ENQ-1102");
    expect(checked.text).not.toContain("Tell me the date");
  });

  test("a number that is not money is left alone", () => {
    const reply = "The S-Class seats 3, with 2 large cases, and there is a 4 hour minimum.";

    expect(checkReply(reply, nothingCreated)).toEqual({ text: reply, corrections: [] });
  });
});

describe("what is free, which nothing here knows", () => {
  test("a reply that says a car is available never goes out", () => {
    for (const reply of [
      "Yes, the Cullinan is available on Saturday.",
      "We have a Ghost available for your wedding.",
      "That one's available, shall I put it through?",
      // Mentioning the team does not make the first half true.
      "Yes, the Cullinan is available on Saturday and the team will be in touch.",
      "Don't worry, the Ghost is available.",
      "The Ghost is free that day.",
      "The Urus is unavailable Saturday.",
      "Sorry, the Urus is fully booked on the 19th.",
      "I can't check myself, but the Ghost is free on Saturday.",
      "That one\u2019s available, shall I put it through?",
    ]) {
      const checked = checkReply(reply, nothingCreated);
      expect(checked.corrections, reply).toContain("availability_claim_dropped");
      expect(checked.text).toContain("the team will confirm what they have");
    }
  });

  test("being honest about it is left alone", () => {
    for (const reply of [
      "I can't check availability myself, the team will confirm it.",
      "I cannot say whether it is available, but I can take the details.",
      "The team will confirm what's available once they have the date.",
      "Is the date flexible at all?",
      "What time are you free on Saturday?",
    ]) {
      expect(checkReply(reply, nothingCreated).corrections, reply).not.toContain("availability_claim_dropped");
    }
  });

  test("describing what the company offers is not promising a day", () => {
    for (const reply of [
      "We're available 24 hours a day, message or ring whenever suits you.",
      "Child seats are available.",
      "The Ghost is available for weddings and airport transfers.",
      "The Lamborghini is available for self-drive hire.",
      "Feel free to message on Saturday if anything changes.",
      "The S-Class is priced on request.",
    ]) {
      expect(checkReply(reply, nothingCreated).corrections, reply).not.toContain("availability_claim_dropped");
    }
  });

  test("only the claim goes: the reference and the rest of the reply stay", () => {
    const checked = checkReply("The Ghost is available on the 19th. I've passed it to the team as ENQ-1102.", {
      created: { kind: "enquiry", reference: "ENQ-1102" },
      references: ["ENQ-1102"],
    });

    expect(checked.text).toContain("ENQ-1102");
    expect(checked.text).not.toContain("available on the 19th");
    // The journey has just been given, so it is not asked for again.
    expect(checked.text).not.toContain("Tell me the date");
  });

  test("a reference given in the same sentence is still given", () => {
    const checked = checkReply("Great, the Ghost is available, I've passed it to the team as ENQ-1102.", {
      created: { kind: "enquiry", reference: "ENQ-1102" },
      references: ["ENQ-1102"],
    });

    expect(checked.corrections).toContain("availability_claim_dropped");
    expect(checked.text).toContain("Your reference is ENQ-1102.");
  });
});

describe("a change the backend did not make", () => {
  const ENQ = "ENQ-1100";
  /** The backend moved the date and time on ENQ-1100 this turn. */
  const moved = {
    created: null,
    references: [ENQ],
    confirmed: [{ kind: "updated" as const, reference: ENQ, fields: ["date" as const, "time" as const] }],
    attempted: [{ kind: "updated" as const, reference: ENQ, fields: ["date" as const, "time" as const] }],
  };

  test("is never claimed when nothing changed", () => {
    for (const reply of [
      "I've updated your enquiry to Friday at 4pm.",
      "That's been moved to Friday.",
      "Your enquiry has been cancelled.",
      "I have rescheduled it for you.",
      "Changed your pickup to Heathrow.",
      "I\u2019ve moved it to Friday.",
    ]) {
      const checked = checkReply(reply, nothingCreated);
      expect(checked.corrections, reply).toContain("unmade_change_claim_dropped");
      expect(checked.text).toContain("couldn't make that change");
    }
  });

  test("and the person the fallback promises is actually fetched", () => {
    const checked = checkReply("I've moved it to Friday.", nothingCreated);
    expect(checked.handoff?.reason).toBe("cannot_help");
  });

  test("is allowed exactly when the backend made it", () => {
    const reply = "I've updated your enquiry ENQ-1100 to Friday at 4pm.";
    const checked = checkReply(reply, moved);

    expect(checked.text).toBe(reply);
    expect(checked.corrections).toEqual([]);
    expect(checked.handoff).toBeUndefined();
  });

  test("recording an enquiry licenses its own 'all done'", () => {
    const checked = checkReply("All done, your reference is ENQ-1100.", {
      created: { kind: "enquiry", reference: "ENQ-1100" },
      references: ["ENQ-1100"],
    });

    expect(checked.corrections).toEqual([]);
  });

  test("offering a change is not claiming one", () => {
    for (const reply of [
      "Would you like me to change it to Friday?",
      "I can move that to Friday if you like.",
      "Shall I cancel it?",
      "You can change it any time, just say.",
    ]) {
      expect(checkReply(reply, nothingCreated).corrections, reply).not.toContain("unmade_change_claim_dropped");
    }
  });

  test("a change made in an earlier turn may still be said", () => {
    const checked = checkReply("Yes, it's been moved to Friday the 25th.", {
      created: null,
      references: [ENQ],
      confirmedEarlier: moved.confirmed,
    });

    expect(checked.corrections).toEqual([]);
  });

  test("a cancellation the office made, read back from its record, may be said", () => {
    const checked = checkReply("Your Saturday enquiry has been cancelled.", {
      created: null,
      references: [ENQ],
      confirmed: [{ kind: "cancelled", reference: ENQ }],
    });

    expect(checked.corrections).toEqual([]);
  });

  test("one change that worked does not cover another that failed", () => {
    const checked = checkReply("I've moved it to Friday and changed the car to the Ghost.", {
      created: null,
      references: [ENQ],
      confirmed: [{ kind: "updated", reference: ENQ, fields: ["date"] }],
      attempted: [
        { kind: "updated", reference: ENQ, fields: ["date"] },
        { kind: "updated", reference: ENQ, fields: ["vehicleId"] },
      ],
    });

    expect(checked.corrections).toContain("unmade_change_claim_dropped");
  });

  test("an earlier change to the date does not cover a new claim about the car", () => {
    const checked = checkReply("I've changed the car to the Bentayga.", {
      created: null,
      references: [ENQ],
      confirmedEarlier: [{ kind: "updated", reference: ENQ, fields: ["date"] }],
    });

    expect(checked.corrections).toContain("unmade_change_claim_dropped");
  });

  test("an earlier move does not cover one that was refused this turn", () => {
    const checked = checkReply("I've moved it to the 27th.", {
      created: null,
      references: [ENQ],
      confirmedEarlier: [{ kind: "updated", reference: ENQ, fields: ["date"] }],
      attempted: [{ kind: "updated", reference: ENQ, fields: ["date"] }],
    });

    expect(checked.corrections).toContain("unmade_change_claim_dropped");
  });

  test("an update is not a cancellation, and a change to one enquiry is not a change to another", () => {
    expect(checkReply("That one has been cancelled.", moved).corrections).toContain("unmade_change_claim_dropped");
    expect(
      checkReply("I've moved ENQ-1200 to Friday.", { ...moved, references: [ENQ, "ENQ-1200"] }).corrections,
    ).toContain("unmade_change_claim_dropped");
  });

  test("recording a new enquiry does not cover cancelling another", () => {
    const checked = checkReply("That's with the team as ENQ-1102, and I've cancelled your Saturday one.", {
      created: { kind: "enquiry", reference: "ENQ-1102" },
      references: [ENQ, "ENQ-1102"],
    });

    expect(checked.corrections).toContain("unmade_change_claim_dropped");
    // The new enquiry is still named.
    expect(checked.text).toContain("ENQ-1102");
  });

  test("a change to the journey still being taken down may be said", () => {
    const checked = checkReply("I've changed the time to 4pm. Shall I send it to the team?", {
      created: null,
      references: [],
      confirmed: [{ kind: "updated", fields: ["time"] }],
    });

    expect(checked.corrections).toEqual([]);
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
