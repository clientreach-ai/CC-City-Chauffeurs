/**
 * When a journey may be, judged once for every door it can arrive through.
 *
 * The website's form, the assistant on WhatsApp and the office amending an
 * enquiry all have to agree about what a usable date is, so the rule lives
 * here and each of them calls it. Before this, the assistant held the only
 * copy and the server held none, which is how a journey in 2089 reached the
 * office.
 *
 * Dates are the business's own "YYYY-MM-DD" strings throughout, and the day
 * they are compared against is today in `Europe/London`. Date-only
 * arithmetic needs no clock and no offset, so there is nothing here that a
 * daylight-saving change can move.
 */

/**
 * How far ahead a journey may be requested, when the settings do not say.
 *
 * **Proposed, not company policy.** The only booking window City Chauffeurs
 * publishes is "We ask for 48 hours' notice wherever possible" — a minimum,
 * with nothing at the far end. Twelve months is our proposal: long enough
 * for a wedding booked a year out, short enough that a mistyped year is
 * caught. It needs Faheem's approval before it governs real customers, and
 * it is a setting so that approval does not need a deploy.
 */
export const PROPOSED_MAX_MONTHS_AHEAD = 12;

/** Today in London, as "YYYY-MM-DD" — the date the business and its customers mean. */
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

/**
 * A day that exists, written the way the business writes it.
 *
 * The round trip through `toISOString` is what catches 31 February: the
 * `Date` constructor rolls it forward to 3 March, and the result no longer
 * matches what was asked for.
 */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * The last date a journey may be asked for.
 *
 * Months, not days, because the rule the client would state is "a year
 * ahead" rather than "365 days". A month end that does not exist in the
 * target month is clamped to the last day that does, so 31 August plus six
 * months is 28 February rather than 3 March.
 */
export function horizonDate(today: string, maxMonthsAhead: number): string {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const target = month - 1 + maxMonthsAhead;
  const targetYear = year + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const lastOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastOfMonth);
  return new Date(Date.UTC(targetYear, targetMonth, safeDay)).toISOString().slice(0, 10);
}

export type HorizonSettings = {
  /** Today in London, as "YYYY-MM-DD". */
  today: string;
  maxMonthsAhead?: number;
};

/**
 * Why this date cannot be used, in words that can be passed to a customer,
 * or `null` when it can.
 *
 * Three refusals, and each says enough that the next message can be the
 * right question rather than the same one again.
 */
export function journeyDateRefusal(value: string, settings: HorizonSettings): string | null {
  if (!isRealDate(value)) return "Give the date as YYYY-MM-DD, and a day that exists.";
  if (value < settings.today) return `That date has passed — today is ${settings.today}.`;

  const months = settings.maxMonthsAhead ?? PROPOSED_MAX_MONTHS_AHEAD;
  const last = horizonDate(settings.today, months);
  if (value > last) {
    return `That is further ahead than we arrange journeys — we take them up to ${last}, about ${months} months out. Ask the customer for a date nearer the journey.`;
  }
  return null;
}
