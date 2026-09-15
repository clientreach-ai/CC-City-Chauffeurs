import { env } from "@CC-City-Chauffeurs/env/web";

/**
 * Sending an enquiry from the website.
 *
 * The enquiry is recorded first, so it appears in the admin's inbox whether
 * or not the visitor goes on to send the WhatsApp message — an enquiry that
 * only exists in a chat window is one that can be missed. It is deliberately
 * forgiving: if recording fails, the visitor still gets their message and is
 * never shown an error about our database.
 */

export type EnquiryPayload = {
  name: string;
  phone: string;
  email: string;
  replyBy: "whatsapp" | "phone" | "email";
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
};

export async function recordEnquiry(payload: EnquiryPayload): Promise<string | null> {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "")}/api/public/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { reference?: string };
    return body.reference ?? null;
  } catch {
    return null;
  }
}
