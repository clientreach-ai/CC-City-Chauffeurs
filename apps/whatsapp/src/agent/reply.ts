/**
 * The last thing between the model and the customer.
 *
 * The prompt tells the assistant to give a reference exactly as a tool
 * returned it, never to invent one, and never to call a request a booking.
 * A prompt is guidance; this is not. These rules are settled here, in code,
 * on the finished text:
 *
 *   1. A reference the customer is given must be one that exists. A number
 *      the model made up is never sent.
 *   2. A record made during this turn must be named in the reply. A customer
 *      told "that is with the team" and given no reference has nothing to
 *      quote when they ring.
 *   3. A booking request must not read as a confirmed booking.
 *   4. Nothing is said to be free, and no change is said to be made, unless
 *      the backend said so. A customer told "that's moved to Friday" has
 *      stopped worrying about it.
 *   5. No reply joins its clauses with a dash. A model reaches for an em
 *      dash constantly and a person typing on a phone almost never does, so
 *      it is the clearest tell that nobody wrote the message. The prompt
 *      asks; this makes sure.
 *
 * Narrow on purpose. This is not a censor and it does not try to read the
 * reply: it matches references, which have a shape, short lists of words
 * that would make a request sound settled or a car sound free, and the verbs
 * that say a record was changed.
 */

import type { ChangeAttempt, ConfirmedChange, JourneyField } from "../ports";

/** ENQ-1100, BKG-2100 — the only reference shapes the business issues. */
const REFERENCE = /\b(?:ENQ|BKG)-\d{1,8}\b/gi;

/** Said of a booking request, these would be a promise nobody has made. */
/**
 * A reply that has told the customer the journey is settled.
 *
 * "Confirmed" is deliberately not here: "your enquiry is confirmed as
 * received" is true and ordinary, and the assistant should not be made to
 * argue with itself about it. The words below cannot be read any other way.
 */
const SOUNDS_SETTLED = /\b(booked|reserved|guaranteed|secured)\b/i;

const NOT_YET_CONFIRMED =
  "This is an enquiry rather than a confirmed booking, the team will confirm it with you here.";

/**
 * When the model has quoted a reference that does not exist and there is no
 * real one to put in its place, the whole reply goes: it cannot be trusted
 * about the thing the customer will write down.
 */
/**
 * A sum of money the data never gave. The reply goes: a wrong price is the
 * one thing a customer acts on, repeats to somebody else, and holds the
 * company to.
 */
/**
 * Saying a car is free, which nothing in this system can establish.
 *
 * There is no availability anywhere: the diary holds a date and a time and
 * nothing that says when a car is back. Three facts get confused here and
 * only the first two are knowable — the car is in the fleet, the customer
 * asked for it, and the car is free that day. A reply that asserts the third
 * is replaced rather than qualified, because a customer who has been told
 * their car is available has stopped asking.
 */
const AVAILABILITY_ASK =
  "I can't check what's free myself, I'm afraid. Tell me the date and the journey and the team will confirm what they have.";

/** The same, once the journey is in hand: asking for it again would be the giveaway. */
const AVAILABILITY_IN_HAND =
  "I can't check what's free myself, so the team will confirm what they have when they come back to you.";

/**
 * A reply claiming a change the backend did not make.
 *
 * The one thing worse than failing to reschedule somebody is telling them
 * you did. The tools record what actually changed; anything else that reads
 * as a completed change goes.
 */
const NOT_CHANGED_FALLBACK =
  "Sorry, I couldn't make that change just now. I've let the team know and someone will come back to you here.";

/**
 * What the office is told when that happens. The reply has just promised a
 * person, so the conversation is handed to one: a promise of a call-back
 * nobody hears about is the same lie the check exists to stop.
 */
export const NOT_CHANGED_HANDOFF = {
  reason: "cannot_help",
  summary: "The customer asked for a change to an enquiry that was not made. Check what they asked for and make it, or tell them why not.",
} as const;

const PRICE_ASK =
  "Let me not guess at that. Tell me the date and where you're going and the City Chauffeurs team will come back to you with the figure.";

const PRICE_IN_HAND = "Let me not guess at that. The City Chauffeurs team will come back to you with the figure.";

/**
 * A discount, which is not the assistant's to give.
 *
 * Nobody has authorised a reduction, there is no tool that could record one,
 * and a customer told they have one will hold the company to it. Asking for
 * one is perfectly reasonable, so the reply that replaces it passes the
 * request on rather than refusing it flatly.
 */
const OFFERS_A_DISCOUNT =
  /\b(?:discount|reduced rate|special price|do you a deal|cheaper for you|money off|percent off|%\s*off|knock(?:ed)?\s+(?:it|that|some)?\s*off|waive)\b/i;
/**
 * Only a negation counts as honest here.
 *
 * Deliberately narrower than the availability check, which also lets "the
 * team will confirm" through. A discount is different: "the team have agreed
 * ten percent off" mentions the office and is exactly the sentence that must
 * not go out, so naming them cannot be what makes it acceptable. Nor is a
 * polite word: "No problem, I can do 10% off" and "I'm afraid the best I can
 * do is 10% off" both offer one, so "no" counts only when it is "no
 * discount", and "afraid" not at all.
 */
const HONEST_ABOUT_DISCOUNTS =
  /\b(?:can'?t|cannot|can not|unable|not able|don'?t|do not|doesn'?t|isn'?t|won'?t|never|not something|no (?:discounts?|reductions?|deals?|money off))\b/i;

const DISCOUNT_TO_THE_TEAM =
  "I can't set prices or discounts myself, I'm afraid. I'll pass that to the team and they'll come back to you on it.";

/**
 * Whether a sum of money went out framed as what it is.
 *
 * Every figure the client publishes is a starting rate, so a figure stated
 * bare reads as a quotation the customer can hold us to. The words below are
 * the ordinary ways of saying "about": one of them in the same sentence as
 * the figure is enough, and a false negative only adds a sentence nobody
 * minds. "From" counts only when it is about the money — "from £200" — and
 * not when it is about the journey, or "From Heathrow to Gatwick it is £150"
 * would pass as a guide.
 */
const FRAMED_AS_A_GUIDE =
  /\b(?:guide|indicative|starts?|starting|around|about|roughly|up to|in the region of)\b|\bfrom\s+(?:around\s+|about\s+|roughly\s+)?(?:£|gbp\b|\d)/i;

/**
 * Whether every sentence that names a published figure also frames it.
 *
 * Judged a sentence at a time, because a framing word three sentences away
 * frames nothing: "From Heathrow to Gatwick. The S-Class is £150." still
 * quotes £150 bare.
 */
function everyFigureIsFramed(text: string, officeQuoted: Set<number>): boolean {
  return sentences(text).every((sentence) => {
    const figures = figuresIn(sentence).filter((figure) => !officeQuoted.has(figure));
    return !figures.length || FRAMED_AS_A_GUIDE.test(sentence);
  });
}

const A_GUIDE_NOT_A_QUOTE =
  "That is a guide rather than a final figure, and the team confirm it once they know the journey.";

/**
 * The figures that are the office's own, not the website's starting rates.
 *
 * A quote somebody in the office put against an enquiry *is* the answer, so
 * calling it a guide would be the opposite of the truth. Only the published
 * rates need saying out loud as "from".
 */
export function recordedQuotesIn(text: string): number[] {
  return [...text.matchAll(/"quote":\s*\{\s*"amount":\s*(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => !Number.isNaN(value));
}

const SAFE_FALLBACK =
  "Thank you, your request is with the City Chauffeurs team and someone will reply to you here shortly.";

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

/**
 * What this turn recorded. Only ever an enquiry: the assistant cannot put a
 * row in the diary, because no tool does it.
 */
export type CreatedRecord = { kind: "enquiry"; reference: string };

/**
 * The sums of money in a piece of text, in pounds.
 *
 * Two shapes, because the client's figures arrive as both: a rate field the
 * tools return as a number, and a price written into a sentence the client
 * typed, such as "Day rates start from £500". A figure the customer is told
 * has to be one of these; there is no third source.
 */
export function figuresIn(text: string): number[] {
  const amount = "(\\d[\\d,]*(?:\\.\\d{1,2})?)";
  const found = [
    // The rate fields the tools return, as numbers.
    ...text.matchAll(/"indicative(?:Hourly|Day)Rate":\s*(\d+(?:\.\d+)?)/g),
    // A quote the office recorded on the customer's own enquiry, which is
    // theirs to be told: `"quote":{"amount":450,...}` as the tools return it.
    ...text.matchAll(/"quote":\s*\{\s*"amount":\s*(\d+(?:\.\d+)?)/g),
    // Money written into a sentence, however it is written. "200 pounds" is
    // the same promise as "£200" and is checked the same way.
    ...text.matchAll(new RegExp(`£\\s?${amount}`, "g")),
    ...text.matchAll(new RegExp(`${amount}\\s*(?:pounds|quid|gbp)\\b`, "gi")),
    ...text.matchAll(new RegExp(`\\bgbp\\s?${amount}`, "gi")),
  ];
  return found.map((match) => Number(match[1]!.replace(/,/g, ""))).filter((value) => !Number.isNaN(value));
}

/** Curly apostrophes, which a model uses about as often as straight ones. */
const plain = (text: string) => text.replace(/[‘’]/g, "'");

/** Sentences, roughly: enough to judge one claim at a time. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

/**
 * The clauses of a sentence, so "I can't check myself, but the Ghost is free
 * on Saturday" is judged on its second half rather than excused by its first.
 * Split only where a clause turns, never on "and": "the Ghost and the
 * Cullinan are free" is one claim about two cars.
 */
const clauses = (sentence: string) => sentence.split(/[;:]\s+|,?\s+(?:but|though|although|however)\s+/i);

/**
 * The words that say whether something is free.
 *
 * "Free" only as a state ("is free", "'s still free"), so "feel free" and
 * "free wifi" are left alone. Unavailable and fully booked are claims too:
 * nothing here knows a car is taken any more than it knows one is free.
 */
const AVAILABILITY_WORD =
  /\b(?:un)?availab(?:le|ility)\b|\bnot available\b|\b(?:is|are|'s|be|being|looks|still)\s+(?:still\s+|completely\s+|totally\s+)?free\b(?!\s+(?:wi-?fi|water|parking|of charge|cancellation))|\b(?:fully booked|booked up)\b|\b(?:held|holding|hold)\b(?:\s+\w+){0,3}\s+for you\b|\bon hold\b/i;

/**
 * What makes it a claim about a particular car on a particular day, rather
 * than "we're available around the clock" or "child seats are available".
 *
 * A day or a time; a pointer at the customer's own journey ("your wedding",
 * "that one", "for you"); or the shape of an answer ("yes", "good news",
 * "don't worry"). Without one of these, availability is being described,
 * not promised.
 */
const DAY_OR_TIME =
  /\b(?:today|tonight|tomorrow|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|that day|the day|then|at that time|\d{1,2}(?:st|nd|rd|th)|\d{4}-\d{2}-\d{2}|\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}:\d{2})\b/i;
const ABOUT_THEIR_JOURNEY = /\b(?:your|that one|this one|that car|it'?s|it is|for you|for that)\b/i;
const SOUNDS_LIKE_AN_ANSWER = /^\s*(?:yes|yep|yeah|good news|great news|great|lovely|luckily|happily|don'?t worry|no problem|absolutely|of course)\b/i;

/**
 * Being honest about it: saying it cannot be checked, or that the team will
 * check. Narrow on purpose. "Team" or "confirm" anywhere in the sentence is
 * not enough, or "the Ghost is free on Saturday and the team will be in
 * touch" goes out as written.
 */
const HONEST_ABOUT_AVAILABILITY =
  /\b(?:can'?t|cannot|can not|unable to|not able to|no way to|don'?t|do not)\s+(?:\w+\s+)?(?:check|confirm|see|say|tell|know|promise|guarantee)\b|\bwhether\b|\b(?:check|checks|checking|confirm|confirms|confirming|see|ask|asking)\s+(?:if|whether|availability|what|that|it'?s)\b|\bsubject to availability\b|\bon request\b|\b(?:we'?re|we are|you'?re|you are|they'?re|the team is|our team is|the office is|someone is|somebody is|i'?m|i am)\s+(?:\w+\s+)?(?:available|free)\b/i;

/** A question back to the customer is not a claim: "what time are you free?" */
const ASKS = /^\s*(?:is|are|what|which|when|would|do|does|did|can|could|will|shall|how|where|who)\b.*\?\s*$/i;

function claimsAvailability(sentence: string): boolean {
  const text = plain(sentence);
  if (ASKS.test(text)) return false;
  return clauses(text).some(
    (clause) =>
      AVAILABILITY_WORD.test(clause) &&
      !HONEST_ABOUT_AVAILABILITY.test(clause) &&
      (DAY_OR_TIME.test(clause) || ABOUT_THEIR_JOURNEY.test(clause) || SOUNDS_LIKE_AN_ANSWER.test(text)),
  );
}

/**
 * A reply that says an existing record has been changed.
 *
 * Only the verbs that mean it: "done" and "sorted" are what anybody says
 * after any favour, and reading them as a claim about the database turns
 * "all done, your reference is ENQ-1100" into a failure.
 */
const CHANGE_VERB = "(updated|changed|amended|moved|rescheduled|cancelled|canceled)";
const CLAIMS_CHANGED = new RegExp(
  `\\b(?:i'?ve|i have|we'?ve|we have|that'?s|thats|it'?s|its|has been|have been|is now|now)\\s+(?:now\\s+)?(?:been\\s+)?${CHANGE_VERB}\\b|\\b${CHANGE_VERB}\\s+(?:your|the|that|it)\\b`,
  "gi",
);

/**
 * What a sentence about a change is about, so "I've moved it to Friday and
 * changed the car" is held to both, not passed on the strength of one.
 */
const FIELD_WORDS: [JourneyField, RegExp][] = [
  ["vehicleId", /\b(?:car|vehicle)\b/i],
  ["date", /\b(?:date|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)|\d{4}-\d{2}-\d{2})\b/i],
  ["time", /\b(?:time|noon|midday|midnight|o'?clock|\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}:\d{2})\b/i],
  ["pickup", /\b(?:pick-?up|pick up|collection|collect(?:ing|ed)?)\b/i],
  ["dropoff", /\b(?:drop-?off|drop off|destination)\b/i],
  ["passengers", /\b(?:passengers?|people)\b/i],
  ["luggage", /\b(?:luggage|bags?|suitcases?)\b/i],
  ["flight", /\bflight\b/i],
  ["service", /\bservice\b/i],
  ["message", /\bnote\b/i],
];

type Claim = { kind: ConfirmedChange["kind"]; references: string[]; fields: JourneyField[] };

/** The changes a sentence says were made, if any. */
function changesClaimed(sentence: string): Claim[] {
  const text = plain(sentence);
  const kinds = new Set<ConfirmedChange["kind"]>();
  for (const match of text.matchAll(CLAIMS_CHANGED)) {
    const verb = (match[1] ?? match[2] ?? "").toLowerCase();
    kinds.add(verb.startsWith("cancel") ? "cancelled" : "updated");
  }
  const references = (text.match(REFERENCE) ?? []).map((reference) => reference.toUpperCase());
  const fields = FIELD_WORDS.filter(([, words]) => words.test(text)).map(([field]) => field);
  return [...kinds].map((kind) => ({ kind, references, fields }));
}

export type ReplyCheck = {
  /** What this turn recorded, if anything. */
  created: CreatedRecord | null;
  /** References given earlier in this conversation, which the customer may reasonably be reminded of. */
  references: string[];
  /**
   * Every sum of money the tools put in front of the model this turn, in
   * pounds. Anything else the reply quotes was invented, whatever it looks
   * like, so it never leaves the building.
   *
   * Left out means none were shown, so no price may be said. The default is
   * the strict one on purpose: a caller that forgets this blocks prices
   * rather than waving them through.
   */
  figures?: number[];
  /**
   * Of those figures, the ones the office itself recorded against an
   * enquiry. They are answers rather than guides, so they are not framed as
   * approximate — a customer told the office's own figure is "a guide" would
   * reasonably ask what the point of the quote was.
   */
  quoted?: number[];
  /**
   * What the backend confirmed this turn: changes it made, draft details it
   * accepted, and enquiries it reported cancelled. Left out means none, so
   * no claim of a change may go out.
   */
  confirmed?: ConfirmedChange[];
  /** What it confirmed in earlier turns of this conversation. */
  confirmedEarlier?: ConfirmedChange[];
  /** Every change asked of the backend this turn, made or not. */
  attempted?: ChangeAttempt[];
  /**
   * Whether the customer has already given the journey: the fallbacks then
   * do not ask for it again.
   */
  journeyInHand?: boolean;
};

/**
 * The reply as it may be sent, and why it differs from what the model wrote.
 * `handoff` is set when the reply now promises a person, so one is fetched.
 */
export type CheckedReply = {
  text: string;
  corrections: string[];
  handoff?: { reason: string; summary: string };
  /**
   * The reply, as it went out, tells the customer nobody here can put a
   * figure on it. True whether the model said so or the check replaced an
   * invented price with that answer — either way it has now been said, and
   * the conversation must not produce a figure later as though it had not.
   */
  declinedToPrice?: true;
};

/**
 * A reply that answered a price question by saying nobody here can.
 *
 * The two sentences the check itself substitutes for an invented price are
 * covered by `invented_price_dropped` rather than matched here, so this only
 * has to recognise the model's own ways of declining.
 */
const DECLINED_TO_PRICE =
  /\b(?:can'?t|cannot|can not|not able to|won'?t)\b[^.!?]*\b(?:price|quote|figure|guess|estimate|cost)\b|\bthe (?:[a-z]+ )*?(?:team|office) (?:will|can) (?:come back|confirm)[^.!?]*\b(?:price|figure|quote|cost)\b/i;

/**
 * Whether the backend stands behind a sentence's claim of a change.
 *
 * A change made this turn, a change made earlier in the conversation, a
 * cancellation read back from the office's record, details the journey
 * being taken down accepted, or an enquiry recorded this turn: any of these,
 * about the enquiry the sentence names (or any, if it names none), and about
 * what the sentence says moved. Not one that
 * failed this turn: "I've moved it to the 27th" after the move was refused
 * is exactly the lie, even if the date moved once before.
 */
function backed(claim: Claim, check: ReplyCheck, existing: Set<string>): boolean {
  const about = (reference?: string) =>
    claim.references.length ? reference !== undefined && claim.references.includes(reference.toUpperCase()) : true;

  // An enquiry recorded this turn backs "I've updated it and passed it on",
  // but an unnamed "it" can only mean that one when there is no other
  // enquiry it could mean.
  const created: ConfirmedChange[] =
    check.created && (existing.size === 0 || claim.references.length > 0)
      ? [{ kind: "updated", reference: check.created.reference }]
      : [];
  const thisTurn = [...(check.confirmed ?? []), ...created];
  const succeeded = new Set(
    thisTurn.filter((change) => change.kind === claim.kind && about(change.reference)).flatMap((change) => change.fields ?? []),
  );
  const failed = new Set(
    (check.attempted ?? [])
      .filter((attempt) => attempt.kind === claim.kind && about(attempt.reference))
      .flatMap((attempt) => attempt.fields ?? [])
      .filter((field) => !succeeded.has(field)),
  );
  if (claim.fields.some((field) => failed.has(field))) return false;

  const candidates = [
    ...thisTurn,
    // Earlier changes, less whatever this turn tried to change and could not.
    ...(check.confirmedEarlier ?? []).map((change) => ({
      ...change,
      ...(change.fields ? { fields: change.fields.filter((field) => !failed.has(field)) } : {}),
    })),
  ].filter((change) => change.kind === claim.kind && about(change.reference) && (!change.fields || change.fields.length > 0));

  if (!candidates.length) return false;
  if (!claim.fields.length || claim.kind === "cancelled") return true;
  // "Changed the car" is not backed by a change to the date.
  return candidates.some((change) => !change.fields || change.fields.some((field) => claim.fields.includes(field)));
}

/**
 * The sentences that fail a test, taken out, with the rest of the reply kept
 * exactly as written: a reply that says one wrong thing and three right ones
 * keeps the three.
 */
function withoutSentences(text: string, drop: (sentence: string) => boolean): { text: string; dropped: boolean } {
  const parts = text.split(/((?<=[.!?])[ \t]+|\n+)/);
  let dropped = false;
  let kept = "";
  for (let index = 0; index < parts.length; index += 2) {
    const sentence = parts[index] ?? "";
    if (sentence && drop(sentence)) {
      dropped = true;
      continue;
    }
    kept += sentence + (parts[index + 1] ?? "");
  }
  return { text: kept.replace(/\n{3,}/g, "\n\n").trim(), dropped };
}

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

  // Nothing here can know what is free, so nothing here may say so. Only the
  // sentences that do are taken out, so a reference or a confirmed change in
  // the same reply still reaches the customer.
  const available = withoutSentences(text, claimsAvailability);
  if (available.dropped) {
    const honest = check.journeyInHand || check.created ? AVAILABILITY_IN_HAND : AVAILABILITY_ASK;
    text = available.text ? `${available.text} ${honest}` : honest;
    corrections.push("availability_claim_dropped");
  }

  // "I have moved it to Friday" is a claim about the database. Only the
  // database may license it, and it does so by returning the change. A reply
  // that claims one it did not make cannot be trusted about the rest, so it
  // is replaced, and the person it now promises is fetched.
  const existing = new Set([...known].filter((reference) => reference !== check.created?.reference.toUpperCase()));
  let handoff: CheckedReply["handoff"];
  if (sentences(text).some((sentence) => changesClaimed(sentence).some((claim) => !backed(claim, check, existing)))) {
    text = NOT_CHANGED_FALLBACK;
    handoff = { ...NOT_CHANGED_HANDOFF };
    corrections.push("unmade_change_claim_dropped");
  }

  // A price is the one thing the model may not improvise, so this is not a
  // warning: the reply is replaced by one that asks instead of guessing.
  const published = new Set(check.figures ?? []);
  if (figuresIn(text).some((figure) => !published.has(figure))) {
    text = check.journeyInHand || check.created ? PRICE_IN_HAND : PRICE_ASK;
    corrections.push("invented_price_dropped");
  }

  // A discount nobody has agreed. Only the sentence offering one goes, so a
  // reply that also answers the journey keeps the useful half.
  const discount = withoutSentences(
    text,
    (sentence) => OFFERS_A_DISCOUNT.test(sentence) && !HONEST_ABOUT_DISCOUNTS.test(sentence),
  );
  if (discount.dropped) {
    text = discount.text ? `${discount.text} ${DISCOUNT_TO_THE_TEAM}` : DISCOUNT_TO_THE_TEAM;
    corrections.push("discount_offer_dropped");
  }

  // Every published figure is a starting rate. One stated bare reads as a
  // quotation, so it is said plainly what it is rather than being removed —
  // the figure itself is the customer's answer.
  const officeQuoted = new Set(check.quoted ?? []);
  if (!everyFigureIsFramed(text, officeQuoted) && !text.includes(A_GUIDE_NOT_A_QUOTE)) {
    text = `${text} ${A_GUIDE_NOT_A_QUOTE}`;
    corrections.push("guide_framing_added");
  }

  if (check.created && !text.toUpperCase().includes(check.created.reference.toUpperCase())) {
    text = `${text} Your reference is ${check.created.reference}.`.trim();
    corrections.push("reference_appended");
  }

  // Nothing the assistant records is agreed with anybody yet, so a reply
  // that says otherwise is corrected whatever it recorded.
  if (check.created && SOUNDS_SETTLED.test(text) && !text.includes(NOT_YET_CONFIRMED)) {
    text = `${text} ${NOT_YET_CONFIRMED}`;
    corrections.push("booking_not_confirmed_added");
  }

  // Read off what is going out, after every correction above: a decline the
  // check wrote is as much a decline as one the model wrote.
  const declinedToPrice = corrections.includes("invented_price_dropped") || DECLINED_TO_PRICE.test(text);

  return {
    text,
    corrections,
    ...(handoff ? { handoff } : {}),
    ...(declinedToPrice ? { declinedToPrice: true as const } : {}),
  };
}
