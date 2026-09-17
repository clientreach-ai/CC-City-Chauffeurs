import {
  bookingNotesSchema,
  bookingStatusUpdateSchema,
  customerInputSchema,
  enquiryStatusUpdateSchema,
  noteInputSchema,
  quoteInputSchema,
} from "@CC-City-Chauffeurs/core/schemas";
import { Hono } from "hono";

import { authorName, requires, type Variables } from "../lib/session";
import * as operations from "../repositories/operations";

/**
 * Enquiries, bookings and customers.
 *
 * Everything here is read-and-record. No message is sent to a customer and
 * no chauffeur is dispatched: the admin is the book of record, and the
 * screens say so beside every action.
 */
export const operationRoutes = new Hono<{ Variables: Variables }>()
  .get("/overview", requires("operations.view"), async (c) => c.json(await operations.getOverview()))

  // ------------------------------------------------------------ enquiries
  .get("/enquiries", requires("operations.view"), async (c) =>
    c.json(await operations.getEnquiries()),
  )

  .get("/enquiries/:id", requires("operations.view"), async (c) =>
    c.json(await operations.getEnquiry(c.req.param("id"))),
  )

  .patch("/enquiries/:id/status", requires("operations.edit"), async (c) => {
    const { status, lostReason } = enquiryStatusUpdateSchema.parse(await c.req.json());
    return c.json(await operations.updateEnquiryStatus(c.req.param("id"), status, { lostReason }));
  })

  .post("/enquiries/:id/quote", requires("operations.edit"), async (c) => {
    const quote = quoteInputSchema.parse(await c.req.json());
    return c.json(await operations.recordQuote(c.req.param("id"), quote));
  })

  .post("/enquiries/:id/notes", requires("operations.edit"), async (c) => {
    const { body, author } = noteInputSchema.parse(await c.req.json());
    // The signed-in user is the author; a body cannot claim to be someone else.
    const name = author?.trim() || authorName(c.get("user"));
    return c.json(await operations.addEnquiryNote(c.req.param("id"), body, name), 201);
  })

  .post("/enquiries/:id/booking", requires("operations.edit"), async (c) =>
    c.json(await operations.createBookingFromEnquiry(c.req.param("id")), 201),
  )

  // ------------------------------------------------------------ bookings
  .get("/bookings", requires("operations.view"), async (c) => c.json(await operations.getBookings()))

  /**
   * What else that car is down for that day. The screen asks before it offers
   * to confirm, because the moment to notice a clash is before somebody is
   * told the car is theirs.
   */
  .get("/bookings/:id/clashes", requires("operations.view"), async (c) =>
    c.json(await operations.bookingClashes(c.req.param("id"))),
  )

  .get("/bookings/:id", requires("operations.view"), async (c) =>
    c.json(await operations.getBooking(c.req.param("id"))),
  )

  .patch("/bookings/:id/status", requires("operations.edit"), async (c) => {
    const { status } = bookingStatusUpdateSchema.parse(await c.req.json());
    return c.json(await operations.updateBookingStatus(c.req.param("id"), status));
  })

  .patch("/bookings/:id/notes", requires("operations.edit"), async (c) => {
    const { notes } = bookingNotesSchema.parse(await c.req.json());
    return c.json(await operations.updateBookingNotes(c.req.param("id"), notes));
  })

  // ------------------------------------------------------------ customers
  .get("/customers", requires("operations.view"), async (c) =>
    c.json(await operations.getCustomers()),
  )

  .get("/customers/:id", requires("operations.view"), async (c) =>
    c.json(await operations.getCustomer(c.req.param("id"))),
  )

  .patch("/customers/:id", requires("operations.edit"), async (c) => {
    const input = customerInputSchema.parse(await c.req.json());
    return c.json(await operations.updateCustomer(c.req.param("id"), input));
  });
