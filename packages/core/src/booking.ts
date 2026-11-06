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
 * Twelve months is the client's window, approved by Faheem. What City
 * Chauffeurs publishes alongside it is only the near end — "We ask for 48
 * hours' notice wherever possible" — so this is the far one: long enough for
 * a wedding booked a year out, short enough that a mistyped year is caught.
 * It remains a setting as well as a default, so the office can move it
 * without a deploy.
 */
export const DEFAULT_MAX_MONTHS_AHEAD = 12;

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

/**
 * The date this many days before the one given.
 *
 * Date-only arithmetic in UTC, where every day is the same length, so a
 * clock change cannot move the answer. Noon is used as the anchor for the
 * same reason.
 */
function daysBefore(date: string, days: number): string {
  if (!days) return date;
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const anchor = Date.UTC(year, month - 1, day, 12) - days * 86_400_000;
  return new Date(anchor).toISOString().slice(0, 10);
}

export type HorizonSettings = {
  /** Today in London, as "YYYY-MM-DD". */
  today: string;
  maxMonthsAhead?: number;
  /**
   * How many days before today are still acceptable. None, conversationally:
   * an assistant asked for yesterday should ask again.
   *
   * The website's form allows one, deliberately — "today" for a visitor
   * abroad can be yesterday here — and the server keeps that tolerance so
   * the two layers cannot disagree about the same date.
   */
  graceDays?: number;
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

  const earliest = daysBefore(settings.today, settings.graceDays ?? 0);
  if (value < earliest) return `That date has passed — today is ${settings.today}.`;

  const months = settings.maxMonthsAhead ?? DEFAULT_MAX_MONTHS_AHEAD;
  const last = horizonDate(settings.today, months);
  if (value > last) {
    // Read by a visitor on the website as well as by the assistant, so it
    // states the rule and leaves what to do about it to the caller.
    return `That is further ahead than we arrange journeys. We take them up to ${last}, about ${months} months from today.`;
  }
  return null;
}

/**
 * Now in London, as "HH:MM" on a 24-hour clock.
 *
 * `h23` rather than `hour12: false`, which renders midnight as "24:00" on
 * some platforms and would make every journey on a given day look as though
 * its time had already gone by.
 */
export function londonClock(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/**
 * The pick-up time as a clock reading, or `null` when the field does not
 * give one.
 *
 * The time on an enquiry is free text rather than a clock. The website's
 * form sends "19:30", but a customer on WhatsApp says "around 7" or "after
 * the ceremony" and the assistant records what they said. Only an
 * unambiguous 24-hour reading is taken as a time; everything else means
 * "sometime that day", which is the safe reading — it can make a journey
 * look later than it is, never earlier.
 */
export function clockTime(value: string | null | undefined): string | null {
  const match = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(value ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

/**
 * Has this journey's moment already gone by in London?
 *
 * Used to decide that an enquiry nobody acted on is finished. It fails
 * towards "not yet" at every turn: a date that is not a date, or a time
 * nobody can read, leaves the journey ahead of us. Closing an enquiry early
 * hides live business from the office, and nothing here is worth that.
 */
export function journeyHasPassed(
  journey: { date: string; time?: string | null },
  now: Date = new Date(),
): boolean {
  const date = (journey.date ?? "").trim();
  if (!isRealDate(date)) return false;

  const today = londonToday(now);
  if (date < today) return true;
  if (date > today) return false;

  // Today: a stated time has to have gone by. Anything vaguer gets the whole
  // day, and passes at midnight along with the date.
  const at = clockTime(journey.time);
  return at !== null && londonClock(now) > at;
}
