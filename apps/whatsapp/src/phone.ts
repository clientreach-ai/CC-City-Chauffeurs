/**
 * Telephone numbers, made comparable.
 *
 * A customer is found by their number, so the same number has to look the
 * same however it arrived: `07700 900321` typed into the admin by someone in
 * the office, `+44 7700 900321` pasted from an email, and `whatsapp:+447700900321`
 * from Twilio must all become `+447700900321`, or one person becomes three
 * customers. Anything that cannot be made into a real number is refused here
 * rather than stored and matched against later.
 */

import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js";
import type { E164 } from "./ports";

/** The value is not a telephone number we can be sure of. Says what was wrong, never echoes the value. */
export class InvalidPhoneNumberError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "InvalidPhoneNumberError";
  }
}

export type NormaliseOptions = {
  /**
   * The country to read a national-form number in. Staff in the London office
   * type UK numbers without the `+44`, so the admin passes `"GB"`; numbers
   * from WhatsApp always carry their `+` and need none.
   */
  defaultRegion?: CountryCode;
};

const WHATSAPP_PREFIX = /^whatsapp:/i;

/**
 * Ofcom keeps `07700 900000`–`07700 900999` and `01632 960000`–`01632 960999`
 * for drama and documentation: they will never be given to anybody.
 * libphonenumber rightly calls them invalid, but every fixture, example and
 * simulated customer in this project uses them precisely because no real
 * person can be reached on one, so they are let through. A customer cannot
 * write from one, so accepting them here matches nobody by mistake.
 */
const OFCOM_DRAMA_RANGES = [/^7700900\d{3}$/, /^1632960\d{3}$/];

/** Twilio addresses WhatsApp numbers as `whatsapp:+447700900321`. The prefix is transport, not number. */
export const stripWhatsAppPrefix = (value: string): string => value.trim().replace(WHATSAPP_PREFIX, "");

/**
 * Returns the number in E.164, or throws `InvalidPhoneNumberError`.
 *
 * Validity is the strict check — the number must be one that could actually
 * be assigned in its country — rather than merely the right length, because a
 * number that is only "possible" is still one nobody can be reached on.
 */
export function normalisePhone(value: string, options: NormaliseOptions = {}): E164 {
  let candidate = value.trim();
  if (candidate === "") throw new InvalidPhoneNumberError("The telephone number is empty.");

  // `00` is how much of the world dials out internationally; it means the same as `+`.
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;

  // Without a country, `07700 900321` could be a number in any of several
  // places. Guessing would match the wrong customer, so refuse instead.
  if (!candidate.startsWith("+") && !options.defaultRegion) {
    throw new InvalidPhoneNumberError("The telephone number needs its country code.");
  }

  const parsed = parsePhoneNumberFromString(candidate, options.defaultRegion);
  const isDrama =
    parsed?.countryCallingCode === "44" && OFCOM_DRAMA_RANGES.some((range) => range.test(parsed.nationalNumber));
  if (!parsed || !(parsed.isValid() || isDrama)) {
    throw new InvalidPhoneNumberError("The telephone number is not a valid number.");
  }
  return parsed.format("E.164") as E164;
}

/** As `normalisePhone`, but `null` for anything it would refuse. */
export function tryNormalisePhone(value: string, options: NormaliseOptions = {}): E164 | null {
  try {
    return normalisePhone(value, options);
  } catch (error) {
    if (error instanceof InvalidPhoneNumberError) return null;
    throw error;
  }
}
