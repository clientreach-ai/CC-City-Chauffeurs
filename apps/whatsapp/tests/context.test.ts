/**
 * What the model is told about the conversation it is in.
 *
 * This is the half of the prompt that changes every turn, and it is where a
 * real failure came from: a customer gave a passenger count, an enquiry was
 * recorded, and the assistant then said it did not have the figure saved —
 * about something the office was holding in full. The context had said "no
 * journey is being discussed", which is true of the draft and useless to the
 * customer.
 */

import { describe, expect, test } from "bun:test";

import { buildContext } from "../src/agent/prompt";
import type { RecordedEnquiry } from "../src/ports";

const base = {
  today: "2027-01-10",
  customerName: null,
  profileName: null,
  journey: {},
  references: [] as string[],
  recorded: [] as RecordedEnquiry[],
  fleet: null,
};

describe("before anything is recorded", () => {
  test("says plainly that there is no journey yet", () => {
    expect(buildContext(base)).toContain("No journey is being discussed at the moment");
  });

  test("the draft is listed field by field while it is being taken", () => {
    const context = buildContext({ ...base, journey: { pickup: "Mayfair", passengers: 2 } });
    expect(context).toContain("pickup: Mayfair");
    expect(context).toContain("passengers: 2");
  });

  test("names the day of the week, so a relative date can be worked out", () => {
    expect(buildContext(base)).toContain("Sunday 2027-01-10");
  });
});

describe("once an enquiry is recorded", () => {
  const recorded: RecordedEnquiry[] = [
    {
      reference: "ENQ-1100",
      date: "2027-02-14",
      time: "10:00",
      pickup: "Mayfair",
      dropoff: "Heathrow",
      passengers: 2,
      vehicle: "Rolls-Royce Ghost",
      status: "New",
    },
  ];

  test("the passenger count is in front of the model", () => {
    expect(buildContext({ ...base, recorded })).toContain("2 passengers");
  });

  test("it does not say nothing is being discussed", () => {
    const context = buildContext({ ...base, recorded });
    expect(context).not.toContain("No journey is being discussed at the moment");
    expect(context).toContain("No new journey is being discussed");
  });

  test("it says where a detail it has not been given can be read from", () => {
    const context = buildContext({ ...base, recorded });
    expect(context).toContain("get_my_enquiries");
    expect(context).toContain("never by saying you do not have it");
  });

  test("the reference carries its status, so a cancelled one is not talked up", () => {
    const cancelled = [{ ...recorded[0]!, status: "Cancelled" }];
    expect(buildContext({ ...base, recorded: cancelled })).toContain("ENQ-1100 (Cancelled)");
  });

  test("a new journey being taken alongside it is still listed separately", () => {
    const context = buildContext({ ...base, recorded, journey: { pickup: "Chelsea", date: "2027-03-01" } });
    expect(context).toContain("pickup: Chelsea");
    expect(context).toContain("ENQ-1100");
    expect(context).toContain("Recorded so far");
  });
});
