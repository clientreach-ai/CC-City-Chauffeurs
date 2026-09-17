import { env } from "@CC-City-Chauffeurs/env/web";

/**
 * Sending an enquiry or a booking request from the website.
 *
 * Both are recorded against the business's own inbox before anything is
 * handed to WhatsApp or email — a request that exists only in a chat window
 * is one that can be missed, and the admin's pipeline is built on having the
 * record.
 *
 * Nothing here is fire-and-forget. A visitor who has just written out a
 * wedding itinerary is owed the truth about whether we have it, so every
 * answer the API can give comes back as something the form can act on: a 422
 * belongs beside the field that caused it, a 429 is worth waiting out, and an
 * unreachable API is worth pressing again. A failure the caller cannot see is
 * a failure nobody ever fixes.
 */

const BASE = `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "")}/api/public`;

/** What both forms ask for: who is asking, and about what journey. */
type JourneyPayload = {
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicleId: string | null;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  passengers: number | null;
  luggage: string;
  flight: string;
  message: string;
  /**
   * The browser's own id for this submission, unchanged across every retry.
   * It is what stops a second press, or a send that timed out on the way
   * back, leaving the office two identical records to untangle: the API
   * returns the reference it recorded the first time.
   */
  submissionId: string;
  /** The honeypot. No person can see the field, so this is always "". */
  website: string;
};

export type EnquiryPayload = JourneyPayload & {
  replyBy: "whatsapp" | "phone" | "email";
};

/** A booking request has no reply-by, and its date is not optional. */
export type BookingPayload = JourneyPayload;

/**
 * What happened, in terms a form can render.
 *
 * A reference of "" is a success with nothing recorded: the honeypot was
 * filled, and the API answers a bot exactly as it answers a person, minus the
 * row. The form shows its usual success state rather than teaching whoever
 * wrote the bot which field gave them away.
 */
export type SubmissionResult =
  | { ok: true; reference: string }
  | { ok: false; reason: "invalid"; message: string; fields: Record<string, string> }
  | { ok: false; reason: "rate-limited"; message: string; retryAfter: number | null }
  | { ok: false; reason: "too-large"; message: string }
  | { ok: false; reason: "failed"; message: string };

/**
 * What a visitor is told when the reason is ours and not theirs — a network
 * that dropped, an origin that refused, a server that fell over. It names no
 * status code and no host: none of that is theirs to read, and the way out of
 * all three is the same.
 */
const UNAVAILABLE =
  "We couldn't submit your request. Please try again, or contact us directly.";

type ApiBody = {
  reference?: unknown;
  error?: unknown;
  fields?: Record<string, string>;
};

/**
 * The body, where there is one.
 *
 * A proxy in front of the API can answer a 502 with a page of HTML, and that
 * must not throw on its way to the visitor's error message.
 */
async function readBody(response: Response): Promise<ApiBody> {
  if (!response.headers.get("content-type")?.includes("application/json")) return {};
  try {
    return (await response.json()) as ApiBody;
  } catch {
    return {};
  }
}

/** The API's own wording where it has some, ours where it has not. */
const wording = (body: ApiBody, fallback: string) =>
  typeof body.error === "string" && body.error.trim() ? body.error : fallback;

async function send(path: string, payload: JourneyPayload): Promise<SubmissionResult> {
  let response: Response;
  try {
    // No credentials: this is the public surface and there is no session to
    // send. Anything that stops the request leaving — a lost signal, a
    // blocked origin — lands in the catch as one indistinguishable failure.
    response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, reason: "failed", message: UNAVAILABLE };
  }

  const body = await readBody(response);

  if (response.ok) {
    return { ok: true, reference: typeof body.reference === "string" ? body.reference : "" };
  }

  if (response.status === 422) {
    // The per-field messages are the useful half of this; the form puts each
    // one beside the input that caused it.
    return {
      ok: false,
      reason: "invalid",
      message: "Some of these details need a look before this can be sent.",
      fields: body.fields ?? {},
    };
  }

  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    return {
      ok: false,
      reason: "rate-limited",
      message: wording(
        body,
        "We have had several messages from this connection in the last few minutes. " +
          "Please try again shortly, or call us and we will take the details over the phone.",
      ),
      retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
    };
  }

  if (response.status === 413) {
    return {
      ok: false,
      reason: "too-large",
      message: wording(
        body,
        "That message is longer than this form can take. Please shorten it.",
      ),
    };
  }

  return { ok: false, reason: "failed", message: UNAVAILABLE };
}

/** Records an enquiry. The office replies; nothing is sent to anybody here. */
export function recordEnquiry(payload: EnquiryPayload) {
  return send("/enquiries", payload);
}

/**
 * Records a booking *request* — a date the visitor would like, not one they
 * have been given. It lands as a pending booking for the office to confirm.
 */
export function requestBooking(payload: BookingPayload) {
  return send("/bookings", payload);
}
