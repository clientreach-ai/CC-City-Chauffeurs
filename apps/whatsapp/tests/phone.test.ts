import { describe, expect, test } from "bun:test";
import { InvalidPhoneNumberError, normalisePhone, stripWhatsAppPrefix, tryNormalisePhone } from "../src/phone";

describe("normalisePhone", () => {
  test("a UK number typed in national form and in international form are the same number", () => {
    const national = normalisePhone("07700 900321", { defaultRegion: "GB" });
    const international = normalisePhone("+44 7700 900321");
    expect(national).toBe(international);
    expect(national).toBe("+447700900321" as typeof national);
  });

  test("a leading 00 is read as +", () => {
    expect(normalisePhone("0044 7700 900321")).toBe(normalisePhone("+447700900321"));
    expect(normalisePhone("  00447700900321  ", { defaultRegion: "GB" })).toBe(normalisePhone("+447700900321"));
  });

  test("an international number is read as itself even with a default region", () => {
    expect(normalisePhone("+1 202 555 0143", { defaultRegion: "GB" })).toBe(normalisePhone("+12025550143"));
  });

  test("a national-form number without a region is refused", () => {
    expect(() => normalisePhone("07700 900321")).toThrow(InvalidPhoneNumberError);
  });

  test("invalid numbers are refused", () => {
    for (const value of ["", "   ", "+44 7700", "+44 1234", "not a number", "+999 123456789", "07700 9003211111"]) {
      expect(() => normalisePhone(value, { defaultRegion: "GB" })).toThrow(InvalidPhoneNumberError);
    }
  });

  test("tryNormalisePhone returns null instead of throwing", () => {
    expect(tryNormalisePhone("07700 900321")).toBeNull();
    expect(tryNormalisePhone("07700 900321", { defaultRegion: "GB" })).toBe(normalisePhone("+447700900321"));
  });
});

describe("stripWhatsAppPrefix", () => {
  test("removes the whatsapp: prefix", () => {
    expect(stripWhatsAppPrefix("whatsapp:+447700900321")).toBe("+447700900321");
    expect(normalisePhone(stripWhatsAppPrefix("whatsapp:+447700900321"))).toBe(normalisePhone("+447700900321"));
  });

  test("leaves a bare number alone", () => {
    expect(stripWhatsAppPrefix("+447700900321")).toBe("+447700900321");
  });
});

describe("Ofcom's drama ranges", () => {
  test("are accepted, so fixtures can use numbers nobody owns", () => {
    expect(normalisePhone("01632 960123", { defaultRegion: "GB" })).toBe(normalisePhone("+441632960123"));
    expect(normalisePhone("+447700900999")).toBe("+447700900999" as ReturnType<typeof normalisePhone>);
  });

  test("but only exactly those ranges", () => {
    expect(() => normalisePhone("+447700901321")).toThrow(InvalidPhoneNumberError);
    expect(() => normalisePhone("+4477009003211")).toThrow(InvalidPhoneNumberError);
    expect(() => normalisePhone("+17700900321")).toThrow(InvalidPhoneNumberError);
  });
});
