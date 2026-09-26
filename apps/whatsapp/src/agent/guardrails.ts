/**
 * Decided before the model is asked.
 *
 * A customer who writes "can I speak to someone" gets a person. That should
 * not depend on the model noticing, agreeing, or being talked out of it by
 * the rest of the message — so it is matched here, in plain code, and the
 * conversation is handed over without the model being consulted at all.
 *
 * The same goes for the handful of things a chauffeur company should never
 * leave to an assistant: an accident, an emergency, a complaint, a refund, a
 * lost belonging. Better to hand over a message that did not need it than to
 * have the assistant cheerfully mishandle one that did.
 *
 * The patterns are narrow on purpose. "Do you have a person who could drive
 * us to Heathrow" should reach the assistant; "can I talk to a person" should
 * not.
 */

export type Escalation = { reason: "customer_asked" | "urgent" | "complaint"; summary: string };

const ASKED_FOR_PERSON = [
  /\b(speak|talk|chat)\s+(to|with)\s+(a|an|some|the)?\s*(one|someone|somebody|person|human|real person|agent|operator|manager|member of (the )?(team|staff)|team|staff|office)\b/i,
  /\b(real|actual|live)\s+(person|human|agent)\b/i,
  /\b(connect|put|transfer)\s+me\s+(to|through|with)\b/i,
  /\b(can|could|please)\s+(someone|somebody|a person|the office|the team)\s+(call|ring|phone|contact)\s+me\b/i,
  // "Call me back", not "call me": "have the chauffeur call me when he's
  // outside" is a journey detail, not a request for the office.
  /\b(call|ring|phone)\s+me\s+back\b/i,
  /\bgive\s+me\s+a\s+(call|ring)\b/i,
  /^\s*(human|agent|operator|person)\s*[.!?]*\s*$/i,
  /\bare\s+you\s+(a\s+)?(bot|robot|real|human)\b.*\b(person|human|someone)\b/i,
];

const URGENT = [
  /\b(accident|crash(ed)?|collision|injur(ed|y)|emergency|police|ambulance|unsafe|danger(ous)?)\b/i,
  /\b(driver|chauffeur)\s+(is\s+|was\s+)?(late|not here|hasn'?t (arrived|turned up|shown up)|didn'?t (arrive|turn up|show))\b/i,
  /\b(stranded|no[- ]show|still waiting)\b/i,
];

const COMPLAINT = [
  /\b(complain(t|ing)?|refund|charged (me )?(twice|wrong)|overcharged|disgusted|unacceptable|appalling)\b/i,
  /\b(left|lost|forgot)\s+(my|a|an|our)\s+\w+(\s+\w+)?\s+(in|inside)\s+the\s+(car|vehicle)\b/i,
  /\blost property\b/i,
];

/** Whether this message should go to a person without the model being asked, and why. */
export function escalationFor(text: string): Escalation | null {
  if (ASKED_FOR_PERSON.some((pattern) => pattern.test(text))) {
    return { reason: "customer_asked", summary: "The customer asked to speak to a person." };
  }
  if (URGENT.some((pattern) => pattern.test(text))) {
    return { reason: "urgent", summary: "The customer raised something urgent — read their last message first." };
  }
  if (COMPLAINT.some((pattern) => pattern.test(text))) {
    return { reason: "complaint", summary: "The customer raised a complaint, a refund or lost property." };
  }
  return null;
}

export const HANDOFF_REPLY =
  "Thank you. I've asked a member of the City Chauffeurs team to pick this up, and they'll reply to you here as soon as they can.";

export const URGENT_REPLY =
  "I've passed this straight to the City Chauffeurs team so a person can help. If anyone is in danger or hurt, please call 999 first.";

export const UNSUPPORTED_REPLY =
  "I can help with text messages only at the moment. If you'd like to send something else, just say so and I'll put you through to the team.";

/**
 * A conversation that has had more turns in an hour than any real one does.
 * Said once, as the assistant stands down — a customer is never told to go
 * away, they are handed to a person.
 */
export const TOO_MANY_REPLY =
  "Thank you for all of this. I'm passing the conversation to a member of the City Chauffeurs team, who will reply here.";

export const FALLBACK_REPLY =
  "I'm sorry, I couldn't answer that just now. I've let the City Chauffeurs team know, and a member of the team will reply to you here.";
