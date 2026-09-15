import {
  assertValid,
  CmsNotFoundError,
  validateTestimonial,
  type PublishStatus,
  type Testimonial,
  type TestimonialInput,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { asc, eq } from "drizzle-orm";

import { iso, newId } from "../lib/ids";

/**
 * Testimonials.
 *
 * Routes: GET/POST /testimonials, PATCH/DELETE /testimonials/:id,
 * PUT /testimonials/order.
 */

type Row = typeof schema.testimonial.$inferSelect;

function toTestimonial(row: Row): Testimonial {
  return {
    id: row.id,
    quote: row.quote,
    firstName: row.firstName,
    role: row.role,
    district: row.district,
    serviceId: row.serviceId,
    date: row.date,
    permission: row.permission,
    position: row.position,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const rows = await db.select().from(schema.testimonial).orderBy(asc(schema.testimonial.position));
  return rows.map(toTestimonial);
}

function columns(input: TestimonialInput) {
  return {
    quote: input.quote,
    firstName: input.firstName,
    role: input.role,
    district: input.district,
    serviceId: input.serviceId,
    date: input.date,
    permission: input.permission,
    status: input.status,
  };
}

export async function createTestimonial(input: TestimonialInput): Promise<Testimonial> {
  assertValid(validateTestimonial(input));
  const count = (await getTestimonials()).length;
  const id = newId("tst");
  await db.insert(schema.testimonial).values({ id, ...columns(input), position: count });
  const [row] = await db
    .select()
    .from(schema.testimonial)
    .where(eq(schema.testimonial.id, id))
    .limit(1);
  return toTestimonial(row!);
}

export async function updateTestimonial(
  id: string,
  input: TestimonialInput,
): Promise<Testimonial> {
  assertValid(validateTestimonial(input));
  const [current] = await db
    .select()
    .from(schema.testimonial)
    .where(eq(schema.testimonial.id, id))
    .limit(1);
  if (!current) throw new CmsNotFoundError("This testimonial");

  await db
    .update(schema.testimonial)
    .set({ ...columns(input), updatedAt: new Date() })
    .where(eq(schema.testimonial.id, id));

  const [row] = await db
    .select()
    .from(schema.testimonial)
    .where(eq(schema.testimonial.id, id))
    .limit(1);
  return toTestimonial(row!);
}

export async function setTestimonialStatus(id: string, status: PublishStatus) {
  const [row] = await db
    .select()
    .from(schema.testimonial)
    .where(eq(schema.testimonial.id, id))
    .limit(1);
  if (!row) throw new CmsNotFoundError("This testimonial");
  return updateTestimonial(id, { ...toTestimonial(row), status });
}

export async function reorderTestimonials(ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(schema.testimonial).set({ position }).where(eq(schema.testimonial.id, id));
    }
  });
}

export async function deleteTestimonial(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.testimonial).where(eq(schema.testimonial.id, id));
    const rest = await tx
      .select()
      .from(schema.testimonial)
      .orderBy(asc(schema.testimonial.position));
    for (const [position, item] of rest.entries()) {
      await tx.update(schema.testimonial).set({ position }).where(eq(schema.testimonial.id, item.id));
    }
  });
}
