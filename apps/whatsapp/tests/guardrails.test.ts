/**
 * The rules decided before the model is asked, tested in both directions.
 *
 * A false negative leaves somebody who asked for a person talking to a bot. A
 * false positive hands an ordinary booking to the office for nothing. Both
 * lists matter.
 */

import { describe, expect, test } from "bun:test";

import { escalationFor } from "../src/agent/guardrails";
import { resolveVehicle, mergeJourney } from "../src/conversation/journey";
import { FLEET, SERVICES } from "./support";

describe("asking for a person", () => {
  for (const text of [
    "I want to speak to someone.",
    "Can I talk to a person?",
    "Connect me to the team please",
    "can i speak with a real person",
    "Put me through to someone",
    "Could someone call me back?",
    "human",
    "Please give me a call",
  ]) {
    test(`"${text}" goes to a person`, () => {
      expect(escalationFor(text)?.reason).toBe("customer_asked");
    });
  }
});

describe("what a person must handle", () => {
  test("an accident is urgent", () => expect(escalationFor("We've had an accident on the M25")?.reason).toBe("urgent"));
  test("a late chauffeur is urgent", () => expect(escalationFor("My driver hasn't arrived and I'm at Heathrow")?.reason).toBe("urgent"));
  test("a complaint", () => expect(escalationFor("I want a refund, this was unacceptable")?.reason).toBe("complaint"));
  test("lost property", () => expect(escalationFor("I left my phone in the car yesterday")?.reason).toBe("complaint"));
});

describe("ordinary conversation stays with the assistant", () => {
  for (const text of [
    "Hi",
    "Do you have a person who could drive us to Heathrow?",
    "Have the chauffeur call me when he's outside",
    "I need a car for 3 people tomorrow",
    "What SUVs do you have?",
    "Is the Cullinan any good for a wedding?",
    "Can you pick us up from the office on Friday?",
  ]) {
    test(`"${text}" is not escalated`, () => {
      expect(escalationFor(text)).toBeNull();
    });
  }
});

describe("naming a vehicle", () => {
  test("a model name finds its car", () => {
    expect(resolveVehicle("S Class", FLEET)).toMatchObject({ vehicle: { id: "veh-sclass" } });
    expect(resolveVehicle("the Cullinan", FLEET)).toMatchObject({ vehicle: { id: "veh-cullinan" } });
    expect(resolveVehicle("a Bentayga", FLEET)).toMatchObject({ vehicle: { id: "veh-bentayga" } });
    expect(resolveVehicle("cullinan", FLEET)).toMatchObject({ vehicle: { id: "veh-cullinan" } });
  });

  test("a make that covers two cars is ambiguous", () => {
    const result = resolveVehicle("Rolls-Royce", FLEET);
    expect("ambiguous" in result && result.ambiguous.map((vehicle) => vehicle.id)).toEqual(["veh-cullinan", "veh-ghost"]);
  });

  test("V-Class means the V-Class, not the JetClass", () => {
    expect(resolveVehicle("V Class", FLEET)).toMatchObject({ vehicle: { id: "veh-vclass" } });
    expect(resolveVehicle("JetClass", FLEET)).toMatchObject({ vehicle: { id: "veh-jet" } });
  });

  test("a car that is not in the fleet is not invented", () => {
    expect(resolveVehicle("Ferrari", FLEET)).toEqual({ unknown: true });
  });
});

describe("the draft", () => {
  const catalogue = { fleet: FLEET, services: SERVICES, today: "2027-01-10" };

  test("a refused value never replaces a good one", () => {
    const first = mergeJourney({}, { date: "2027-02-14" }, catalogue);
    const second = mergeJourney(first.draft, { date: "2027-02-30" }, catalogue);
    expect(second.draft.date).toBe("2027-02-14");
    expect(second.refused[0]?.field).toBe("date");
  });

  test("more passengers than a car is listed for is noted, not refused", () => {
    const result = mergeJourney({}, { vehicle: "S Class", passengers: 5 }, catalogue);
    expect(result.draft.passengers).toBe(5);
    expect(result.notes.join(" ")).toContain("listed for 3 passengers");
  });

  test("a time is normalised to HH:MM", () => {
    expect(mergeJourney({}, { time: "8:05" }, catalogue).draft.time).toBe("08:05");
    expect(mergeJourney({}, { time: "8pm" }, catalogue).refused[0]?.field).toBe("time");
  });
});
