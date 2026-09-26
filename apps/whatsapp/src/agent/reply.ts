/**
 * The last thing between the model and the customer.
 *
 * The prompt tells the assistant to give a reference exactly as a tool
 * returned it, never to invent one, and never to call a request a booking.
 * A prompt is guidance; this is not. Three rules are settled here, in code,
 * on the finished text:
 *
 *   1. A reference the customer is given must be one that exists. A number
 *      the model made up is never sent.
 *   2. A record made during this turn must be named in the reply. A customer
 *      told "that is with the team" and given no reference has nothing to
 *      quote when they ring.
 *   3. A booking request must not read as a confirmed booking.
 *   4. No reply joins its clauses with a dash. A model reaches for an em
 *      dash constantly and a person typing on a phone almost never does, so
 *      it is the clearest tell that nobody wrote the message. The prompt
 *      asks; this makes sure.
 *
 * Narrow on purpose. This is not a censor and it does not try to read the
 * reply: it matches references, which have a shape, and one short list of
 * words that would make a request sound settled.
 */

/** ENQ-1100, BKG-2100 — the only reference shapes the business issues. */
const REFERENCE = /\b(?:ENQ|BKG)-\d{1,8}\b/gi;

/** Said of a booking request, these would be a promise nobody has made. */
const SOUNDS_SETTLED = /\b(confirmed|booked|reserved|guaranteed|secured)\b/i;

const NOT_YET_CONFIRMED =
  "This is a request, not a confirmed booking — a member of the City Chauffeurs team will confirm it here.";

/**
 * When the model has quoted a reference that does not exist and there is no
 * real one to put in its place, the whole reply goes: it cannot be trusted
 * about the thing the customer will write down.
 */
const SAFE_FALLBACK =
  "Thank you — your request is with the City Chauffeurs team, and a member of the team will reply here shortly.";

/**
 * Dashes used as punctuation, and the comma or colon that reads as though a
 * person typed it.
 *
 * Only a dash standing between words is touched. A hyphenated name, a
 * reference like ENQ-1100 and a range like 10-12 are all left exactly as
 * they are, because the pattern requires the surrounding spaces.
 */
function withoutDashes(text: string): string {
  return text
    // " — ", " – ", " - " between clauses: a comma does the same work.
    .replace(/ +[—–] +/g, ", ")
    .replace(/ +- +/g, ", ")
    // A dash opening a line of a list is how lists are written; left alone
    // above by requiring a space before it. An em dash with no space around
    // it still reads as generated.
    .replace(/(\w)[—–](\w)/g, "$1, $2")
    // "Thank you, , the team" cannot happen, but a model that already wrote
    // a comma before its dash would leave one.
    .replace(/, ,/g, ",")
    .replace(/,\s*\./g, ".");
}

export type CreatedRecord = { kind: "enquiry" | "booking"; reference: string };

export type ReplyCheck = {
  /** What this turn recorded, if anything. */
  created: CreatedRecord | null;
  /** References given earlier in this conversation, which the customer may reasonably be reminded of. */
  references: string[];
};

/** The reply as it may be sent, and why it differs from what the model wrote. */
export type CheckedReply = { text: string; corrections: string[] };

export function checkReply(reply: string, check: ReplyCheck): CheckedReply {
  const corrections: string[] = [];
  const known = new Set(
    [...check.references, ...(check.created ? [check.created.reference] : [])].map((reference) => reference.toUpperCase()),
  );

  let text = withoutDashes(reply.trim());
  if (text !== reply.trim()) corrections.push("dashes_replaced");

  const quoted = text.match(REFERENCE) ?? [];
  const invented = quoted.filter((reference) => !known.has(reference.toUpperCase()));
  if (invented.length) {
    if (check.created) {
      // One record was made this turn; a wrong number can only have meant it.
      text = text.replace(REFERENCE, (match) =>
        known.has(match.toUpperCase()) ? match : check.created!.reference,
      );
      corrections.push("invented_reference_replaced");
    } else {
      text = SAFE_FALLBACK;
      corrections.push("invented_reference_dropped");
    }
  }

  if (check.created && !text.toUpperCase().includes(check.created.reference.toUpperCase())) {
    text = `${text} Your reference is ${check.created.reference}.`.trim();
    corrections.push("reference_appended");
  }

  if (check.created?.kind === "booking" && SOUNDS_SETTLED.test(text) && !text.includes(NOT_YET_CONFIRMED)) {
    text = `${text} ${NOT_YET_CONFIRMED}`;
    corrections.push("booking_not_confirmed_added");
  }

  return { text, corrections };
}
