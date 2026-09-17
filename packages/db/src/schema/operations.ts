import type {
  ActivityEntry,
  BookingStatus,
  CustomerType,
  EnquirySource,
  EnquiryStatus,
  LostReason,
  ReplyChannel,
} from "@CC-City-Chauffeurs/core/types";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { vehicle } from "./fleet";

/**
 * Operations — enquiries, the bookings they become, and the customers behind
 * both.
 *
 * Notes and the activity trail are their own tables rather than documents on
 * the parent: they are append-only, they are read in date order, and an
 * enquiry that has been worked for a month should not rewrite a growing JSON
 * blob every time someone adds a line to it.
 *
 * Two things live in the migrations and not here, because drizzle has no way
 * to describe them: the `enquiry_reference_seq` and `booking_reference_seq`
 * sequences that hand out references, and the functional indexes on
 * `lower(trim(email))` and the digits of `phone` that make matching a
 * returning customer a query rather than a table scan. Leaving them out of
 * the schema is deliberate — a generated migration only drops what it has
 * been told about.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").$type<CustomerType>().default("private").notNull(),
    company: text("company").default("").notNull(),
    phone: text("phone").default("").notNull(),
    email: text("email").default("").notNull(),
    notes: text("notes").default("").notNull(),
    ...timestamps,
  },
  (table) => [index("customer_email_idx").on(table.email)],
);

export const enquiry = pgTable(
  "enquiry",
  {
    id: text("id").primaryKey(),
    /** Human reference, e.g. "ENQ-1042". */
    reference: text("reference").notNull().unique(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    /**
     * The contact details as given on the enquiry. Kept verbatim even if the
     * customer record is later corrected — this is what was actually sent.
     */
    contact: jsonb("contact")
      .$type<{ name: string; phone: string; email: string }>()
      .notNull(),
    source: text("source").$type<EnquirySource>().default("website").notNull(),
    replyBy: text("reply_by").$type<ReplyChannel>().default("whatsapp").notNull(),
    journey: jsonb("journey")
      .$type<{
        service: string;
        vehicleId: string | null;
        pickup: string;
        dropoff: string;
        date: string;
        time: string;
        passengers: number | null;
        luggage: string;
        flight: string;
      }>()
      .notNull(),
    message: text("message").default("").notNull(),
    status: text("status").$type<EnquiryStatus>().default("new").notNull(),
    lostReason: text("lost_reason").$type<LostReason | null>(),
    /** A recorded price. Recording it does not send it to anybody. */
    quote: jsonb("quote").$type<{
      amount: number | null;
      note: string;
      recordedAt: string;
    } | null>(),
    bookingId: text("booking_id"),
    /**
     * The client's own id for the submission, when it sends one. A visitor who
     * presses "Open WhatsApp again", loses signal mid-post or double-taps send
     * would otherwise leave two identical records for the office to untangle;
     * the unique index makes the second attempt return the first reference.
     * Null for anything not created from the public form.
     */
    submissionId: text("submission_id"),
    ...timestamps,
  },
  (table) => [
    index("enquiry_status_idx").on(table.status),
    index("enquiry_created_idx").on(table.createdAt),
    index("enquiry_customer_idx").on(table.customerId),
    uniqueIndex("enquiry_submission_idx").on(table.submissionId),
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    enquiryId: text("enquiry_id").references(() => enquiry.id, { onDelete: "set null" }),
    /** A service slug, or one of the extra enquiry options. */
    service: text("service").default("").notNull(),
    /**
     * Kept even when the vehicle is removed from the fleet — a booking is
     * history, and the screens say "no longer listed" rather than quietly
     * changing what was agreed.
     */
    vehicleId: text("vehicle_id").references(() => vehicle.id, { onDelete: "set null" }),
    /** "YYYY-MM-DD" — a calendar date, not an instant. */
    date: text("date").notNull(),
    time: text("time").default("").notNull(),
    pickup: text("pickup").default("").notNull(),
    destination: text("destination").default("").notNull(),
    passengers: integer("passengers"),
    notes: text("notes").default("").notNull(),
    status: text("status").$type<BookingStatus>().default("pending").notNull(),
    /**
     * The client's own id for the submission, when it sends one. A visitor who
     * presses "Open WhatsApp again", loses signal mid-post or double-taps send
     * would otherwise leave two identical records for the office to untangle;
     * the unique index makes the second attempt return the first reference.
     * Null for anything not created from the public form.
     */
    submissionId: text("submission_id"),
    ...timestamps,
  },
  (table) => [
    index("booking_status_idx").on(table.status),
    index("booking_date_idx").on(table.date),
    index("booking_customer_idx").on(table.customerId),
    uniqueIndex("booking_submission_idx").on(table.submissionId),
  ],
);

export const enquiryNote = pgTable(
  "enquiry_note",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id")
      .notNull()
      .references(() => enquiry.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    author: text("author").default("").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("enquiry_note_enquiry_idx").on(table.enquiryId)],
);

/**
 * One trail for both enquiries and bookings. Exactly one of the two parent
 * columns is set; the repository always reads it filtered by one of them.
 */
export const activityEntry = pgTable(
  "activity_entry",
  {
    id: text("id").primaryKey(),
    enquiryId: text("enquiry_id").references(() => enquiry.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => booking.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    kind: text("kind").$type<ActivityEntry["kind"]>().notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    index("activity_enquiry_idx").on(table.enquiryId),
    index("activity_booking_idx").on(table.bookingId),
  ],
);

// ---------------------------------------------------------------- relations

export const customerRelations = relations(customer, ({ many }) => ({
  enquiries: many(enquiry),
  bookings: many(booking),
}));

export const enquiryRelations = relations(enquiry, ({ one, many }) => ({
  customer: one(customer, { fields: [enquiry.customerId], references: [customer.id] }),
  notes: many(enquiryNote),
  activity: many(activityEntry),
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
  customer: one(customer, { fields: [booking.customerId], references: [customer.id] }),
  enquiry: one(enquiry, { fields: [booking.enquiryId], references: [enquiry.id] }),
  vehicle: one(vehicle, { fields: [booking.vehicleId], references: [vehicle.id] }),
  activity: many(activityEntry),
}));

export const enquiryNoteRelations = relations(enquiryNote, ({ one }) => ({
  enquiry: one(enquiry, { fields: [enquiryNote.enquiryId], references: [enquiry.id] }),
}));

export const activityEntryRelations = relations(activityEntry, ({ one }) => ({
  enquiry: one(enquiry, { fields: [activityEntry.enquiryId], references: [enquiry.id] }),
  booking: one(booking, { fields: [activityEntry.bookingId], references: [booking.id] }),
}));
