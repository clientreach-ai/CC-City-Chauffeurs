/**
 * Telling somebody.
 *
 * Until now the system recorded everything and told nobody: an enquiry could
 * sit unread for hours, which is what made a request feel slow however fast
 * the software was. These are the two messages that change that — the office
 * hears that somebody is waiting, and a customer hears when their car is
 * confirmed.
 *
 * Three rules hold here.
 *
 * - **The record comes first.** Every one of these is called after the thing
 *   it describes is safely written, and none of them throws. A mail server
 *   having a bad morning must never cost the client an enquiry.
 * - **Nothing is promised that has not happened.** The customer only hears
 *   from us when the office has actually confirmed the booking; the office
 *   alert says plainly that nothing has been sent to the customer.
 * - **Only what the office needs to act.** A name, a number, the journey,
 *   and a link straight to the record.
 */

import type { Booking, Enquiry } from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/server";

import * as fleet from "../repositories/fleet";
import { mailer, type Email } from "./mail";

/** One line of JSON per email, the same shape the WhatsApp channel logs. */
function log(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ channel: "mail", event, ...fields }));
}

/**
 * Sends, and swallows everything. The caller has already done the part that
 * mattered; this is the part that can safely fail.
 */
async function post(email: Email, about: Record<string, unknown>) {
  const post = mailer();
  try {
    const outcome = await post.send(email);
    if (outcome.ok) log("sent", { ...about, mailer: post.name, id: outcome.id });
    else log("failed", { ...about, mailer: post.name, code: outcome.code, detail: outcome.detail });
  } catch (error) {
    // A mailer is not supposed to throw. If one does, it stops here.
    log("failed", { ...about, mailer: post.name, code: "threw", detail: error instanceof Error ? error.name : "unknown" });
  }
}

/** Runs after the response has gone, so nobody waits on a mail server. */
function afterResponse(work: () => Promise<void>) {
  setTimeout(() => void work(), 0);
}

const or = (value: string | number | null | undefined, fallback = "—") =>
  value === null || value === undefined || value === "" ? fallback : String(value);

async function vehicleName(vehicleId: string | null) {
  if (!vehicleId) return "—";
  try {
    return (await fleet.getVehicle(vehicleId)).name;
  } catch {
    // A vehicle deleted since, or an id from an older record: not worth failing over.
    return "—";
  }
}

const adminLink = (path: string) => `${env.ADMIN_URL.replace(/\/+$/, "")}${path}`;

/** Where an enquiry came in, in the words the office uses. */
const CAME_FROM: Record<string, string> = {
  website: "the website",
  whatsapp: "WhatsApp",
  phone: "the telephone",
  email: "email",
  referral: "a referral",
};

/**
 * A new enquiry, from the website or from WhatsApp.
 *
 * The subject carries the reference and the name, because that is what the
 * office reads on a phone without opening anything.
 */
export function enquiryRecorded(enquiry: Enquiry): void {
  if (!env.OFFICE_EMAIL) return;
  afterResponse(async () => {
    const journey = enquiry.journey;
    const text = [
      `${enquiry.contact.name} has sent an enquiry from ${CAME_FROM[enquiry.source] ?? enquiry.source}.`,
      "",
      `Reference   ${enquiry.reference}`,
      `Name        ${or(enquiry.contact.name)}`,
      `Telephone   ${or(enquiry.contact.phone)}`,
      `Email       ${or(enquiry.contact.email)}`,
      "",
      `Service     ${or(journey.service)}`,
      `Vehicle     ${await vehicleName(journey.vehicleId)}`,
      `Pick-up     ${or(journey.pickup)}`,
      `Drop-off    ${or(journey.dropoff)}`,
      `Date        ${or(journey.date)}`,
      `Time        ${or(journey.time)}`,
      `Passengers  ${or(journey.passengers)}`,
      `Luggage     ${or(journey.luggage)}`,
      `Flight      ${or(journey.flight)}`,
      "",
      ...(enquiry.message ? [`They wrote:`, enquiry.message, ""] : []),
      adminLink(`/enquiries/${enquiry.id}`),
      "",
      "Nothing has been sent to the customer.",
    ].join("\n");

    await post(
      {
        to: env.OFFICE_EMAIL!,
        subject: `${enquiry.reference} — enquiry from ${enquiry.contact.name}`,
        text,
        // Replying to the alert writes to the customer, where we have an address.
        ...(enquiry.contact.email ? { replyTo: enquiry.contact.email } : {}),
      },
      { about: "enquiry", reference: enquiry.reference, source: enquiry.source },
    );
  });
}

/**
 * A booking a customer asked for and nobody has agreed to yet. Worded so
 * that it cannot be mistaken for a booking the office made itself.
 */
export function bookingRequested(booking: Booking, contact: { name: string; phone: string; email: string }): void {
  if (!env.OFFICE_EMAIL) return;
  afterResponse(async () => {
    const text = [
      `${contact.name} has asked for a car. Nothing is confirmed until the office confirms it.`,
      "",
      `Reference   ${booking.reference}`,
      `Name        ${or(contact.name)}`,
      `Telephone   ${or(contact.phone)}`,
      `Email       ${or(contact.email)}`,
      "",
      `Vehicle     ${await vehicleName(booking.vehicleId)}`,
      `Service     ${or(booking.service)}`,
      `Date        ${or(booking.date)}`,
      `Time        ${or(booking.time)}`,
      `Pick-up     ${or(booking.pickup)}`,
      `Drop-off    ${or(booking.destination)}`,
      `Passengers  ${or(booking.passengers)}`,
      "",
      ...(booking.notes ? [booking.notes, ""] : []),
      adminLink(`/bookings/${booking.id}`),
      "",
      "The customer has been told the team will confirm it.",
    ].join("\n");

    await post(
      {
        to: env.OFFICE_EMAIL!,
        subject: `${booking.reference} — booking request from ${contact.name}`,
        text,
        ...(contact.email ? { replyTo: contact.email } : {}),
      },
      { about: "booking_request", reference: booking.reference },
    );
  });
}

/**
 * The customer's confirmation — the one email that goes to somebody outside
 * the office, and only once a person has actually confirmed the booking.
 *
 * Sent only where an address is known. A customer who arranged everything on
 * WhatsApp has already been answered there.
 */
export function bookingConfirmed(booking: Booking, contact: { name: string; email: string }): void {
  if (!contact.email) return;
  afterResponse(async () => {
    const text = [
      `Dear ${contact.name || "Sir or Madam"},`,
      "",
      "Your chauffeur is confirmed.",
      "",
      `Reference   ${booking.reference}`,
      `Vehicle     ${await vehicleName(booking.vehicleId)}`,
      `Date        ${or(booking.date)}`,
      `Time        ${or(booking.time)}`,
      `Pick-up     ${or(booking.pickup)}`,
      `Drop-off    ${or(booking.destination)}`,
      "",
      "If anything about the journey changes, reply to this email or telephone the office and we will see to it.",
      "",
      "City Chauffeurs",
    ].join("\n");

    await post(
      {
        to: contact.email,
        subject: `Your chauffeur is confirmed — ${booking.reference}`,
        text,
        ...(env.OFFICE_EMAIL ? { replyTo: env.OFFICE_EMAIL } : {}),
      },
      { about: "booking_confirmed", reference: booking.reference },
    );
  });
}
