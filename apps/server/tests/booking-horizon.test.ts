/**
 * When a journey may be.
 *
 * The rule the assistant held privately is now shared with the server, so
 * these tests are about the whole rule rather than one door: a day that does
 * not exist, a day that has gone, and a day so far off that it is a typing
 * mistake rather than a booking.
 */

import { describe, expect, test } from "bun:test";

import {
  horizonDate,
  isRealDate,
  journeyDateRefusal,
  londonToday,
  PROPOSED_MAX_MONTHS_AHEAD,
} from "@CC-City-Chauffeurs/core";

const today = "2026-11-05";
const settings = { today, maxMonthsAhead: 12 };

describe("a day that exists", () => {
  test("accepts real dates, including a leap day", () => {
    expect(isRealDate("2026-11-05")).toBe(true);
    expect(isRealDate("2028-02-29")).toBe(true);
  });

  test("refuses 31 February, which the Date constructor would roll forward", () => {
    expect(isRealDate("2027-02-31")).toBe(false);
    expect(isRealDate("2027-02-30")).toBe(false);
    expect(isRealDate("2027-13-01")).toBe(false);
    expect(isRealDate("2027-04-31")).toBe(false);
  });

  test("refuses anything not written the way the business writes it", () => {
    for (const said of ["5 November 2026", "05/11/2026", "2026-11-5", "tomorrow", ""]) {
      expect(isRealDate(said)).toBe(false);
    }
  });
});

describe("the horizon", () => {
  test("twelve months out is the same day next year", () => {
    expect(horizonDate("2026-11-05", 12)).toBe("2027-11-05");
  });

  test("a month end that does not exist in the target month is clamped, not rolled over", () => {
    // 31 August plus six months is February, which has no 31st. Rolling
    // forward would quietly extend the horizon into March.
    expect(horizonDate("2026-08-31", 6)).toBe("2027-02-28");
    expect(horizonDate("2027-08-31", 6)).toBe("2028-02-29");
    expect(horizonDate("2026-01-31", 1)).toBe("2026-02-28");
  });

  test("the year rolls when the months cross December", () => {
    expect(horizonDate("2026-12-01", 1)).toBe("2027-01-01");
    expect(horizonDate("2026-07-01", 18)).toBe("2028-01-01");
  });
});

describe("why a date is refused", () => {
  test("a day that has gone, and the refusal says what today is", () => {
    const refusal = journeyDateRefusal("2026-11-04", settings);
    expect(refusal).toContain("passed");
    expect(refusal).toContain(today);
  });

  test("today itself is fine", () => {
    expect(journeyDateRefusal(today, settings)).toBeNull();
  });

  test("a journey next week, next month and eleven months out are all fine", () => {
    for (const date of ["2026-11-12", "2026-12-20", "2027-10-01"]) {
      expect(journeyDateRefusal(date, settings)).toBeNull();
    }
  });

  test("the 2089 case: refused, and the refusal names the last date we take", () => {
    const refusal = journeyDateRefusal("2089-01-08", settings);
    expect(refusal).not.toBeNull();
    expect(refusal).toContain("2027-11-05");
    expect(refusal).toContain("12 months");
  });

  test("the last day inside the horizon is accepted and the first day outside it is not", () => {
    expect(journeyDateRefusal("2027-11-05", settings)).toBeNull();
    expect(journeyDateRefusal("2027-11-06", settings)).not.toBeNull();
  });

  test("a day that does not exist is refused before anything else is considered", () => {
    expect(journeyDateRefusal("2027-02-31", settings)).toContain("a day that exists");
  });

  test("the horizon the settings give is the one used, not the default", () => {
    expect(journeyDateRefusal("2027-06-01", { today, maxMonthsAhead: 3 })).not.toBeNull();
    expect(journeyDateRefusal("2027-06-01", { today, maxMonthsAhead: 24 })).toBeNull();
  });

  test("with no setting at all it falls back to the proposed default", () => {
    expect(PROPOSED_MAX_MONTHS_AHEAD).toBe(12);
    expect(journeyDateRefusal("2027-10-01", { today })).toBeNull();
    expect(journeyDateRefusal("2089-01-08", { today })).not.toBeNull();
  });
});

describe("today, in London", () => {
  test("is the London date, not the machine's", () => {
    // Just before midnight UTC on New Year's Eve, London and UTC agree;
    // in summer they do not, and the business means London either way.
    expect(londonToday(new Date("2026-06-15T23:30:00Z"))).toBe("2026-06-16");
    expect(londonToday(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });

  test("reads as YYYY-MM-DD, so it compares with a journey date", () => {
    expect(londonToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
