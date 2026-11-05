/**
 * Where we go, and where we do not.
 *
 * The rule has three answers and the middle one is the point: a place nobody
 * listed is a question for the customer, never a refusal. These tests are
 * written mostly to hold that line, because the tempting mistake is to make
 * the classifier decisive and start turning away real work in Milton Keynes.
 */

import { describe, expect, test } from "bun:test";

import {
  classifyLocation,
  locationRefusal,
  DEFAULT_SERVED_COUNTRIES,
  DEFAULT_SERVED_PLACES,
  type Coverage,
} from "@CC-City-Chauffeurs/core";

const coverage: Coverage = {
  serviceAreas: ["Mayfair", "Knightsbridge", "Chelsea", "Kensington", "Fulham", "Canary Wharf"],
  servedPlaces: DEFAULT_SERVED_PLACES,
  servedCountries: DEFAULT_SERVED_COUNTRIES,
};

const outcome = (said: string) => classifyLocation(said, coverage).outcome;

describe("places we cover", () => {
  test("the districts the website prints", () => {
    for (const area of coverage.serviceAreas) expect(outcome(area)).toBe("supported");
  });

  test("London, however it is written", () => {
    for (const said of ["London", "central london", "Greater London", "LONDON"]) {
      expect(outcome(said)).toBe("supported");
    }
  });

  test("the UK beyond London, which is most of the work", () => {
    for (const said of ["Essex", "Manchester", "Birmingham", "Oxford", "Cambridge", "Liverpool", "Edinburgh"]) {
      expect(outcome(said)).toBe("supported");
    }
  });

  test("an airport by name, by code, or with a terminal after it", () => {
    for (const said of ["Heathrow", "LHR", "Gatwick Airport", "Heathrow Terminal 5", "London City Airport"]) {
      expect(outcome(said)).toBe("supported");
    }
  });

  test("Europe, because the client's own sentence says Europe", () => {
    for (const said of ["Paris, France", "Monaco", "Geneva, Switzerland", "Milan, Italy", "Amsterdam, Netherlands"]) {
      expect(outcome(said)).toBe("supported");
    }
  });

  test("a town nobody listed, once the customer says which country", () => {
    expect(outcome("Saffron Walden")).toBe("unclear");
    expect(outcome("Saffron Walden, UK")).toBe("supported");
    expect(outcome("somewhere in Scotland")).toBe("supported");
  });
});

describe("places we do not", () => {
  test("a country we do not cover", () => {
    for (const said of ["El Salvador", "Addis Ababa, Ethiopia", "Dubai, United Arab Emirates", "Tokyo, Japan"]) {
      expect(outcome(said)).toBe("outside");
    }
  });

  test("not of this earth", () => {
    for (const said of ["Mars", "the Moon", "Narnia"]) expect(outcome(said)).toBe("outside");
  });

  test("a country we do not cover beats a place name it happens to contain", () => {
    // Manchester is also a parish in Jamaica. The country decides.
    expect(outcome("Manchester, Jamaica")).toBe("outside");
    expect(classifyLocation("Manchester, Jamaica", coverage)).toEqual({ outcome: "outside", named: "Jamaica" });
  });

  test("the refusal names the country, so the customer is told why", () => {
    expect(locationRefusal("El Salvador", coverage)).toContain("El Salvador");
    expect(locationRefusal("El Salvador", coverage)).toContain("Europe");
  });
});

describe("places we cannot tell about", () => {
  test("a bare airport is a question, not an answer", () => {
    expect(outcome("the airport")).toBe("unclear");
    expect(outcome("airport")).toBe("unclear");
  });

  test("nothing at all", () => {
    expect(outcome("")).toBe("unclear");
    expect(outcome("   ")).toBe("unclear");
  });

  test("a name that is only part of a longer word is not a match", () => {
    // "Bath" is ours; "Bathgate" is a different town in Scotland, and
    // matching it as Bath would be a guess.
    expect(outcome("Bathgate")).toBe("unclear");
  });

  test("unclear never refuses an enquiry", () => {
    expect(locationRefusal("Saffron Walden", coverage)).toBeNull();
    expect(locationRefusal("the airport", coverage)).toBeNull();
    expect(locationRefusal("", coverage)).toBeNull();
  });
});

describe("the client can change where we go without a deploy", () => {
  test("adding a country makes it supported", () => {
    const wider: Coverage = { ...coverage, servedCountries: [...coverage.servedCountries, "Morocco"] };
    expect(classifyLocation("Marrakesh, Morocco", coverage).outcome).toBe("outside");
    expect(classifyLocation("Marrakesh, Morocco", wider).outcome).toBe("supported");
  });

  test("adding a town stops the question being asked", () => {
    const wider: Coverage = { ...coverage, servedPlaces: [...coverage.servedPlaces, "Saffron Walden"] };
    expect(classifyLocation("Saffron Walden", wider).outcome).toBe("supported");
  });

  test("removing a country from the list makes it outside", () => {
    const narrower: Coverage = {
      ...coverage,
      servedCountries: coverage.servedCountries.filter((country) => country !== "France"),
    };
    expect(classifyLocation("Paris, France", narrower).outcome).toBe("outside");
  });
});
