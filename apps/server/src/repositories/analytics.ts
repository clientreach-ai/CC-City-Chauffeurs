/**
 * The business, counted.
 *
 * The overview already reads every enquiry and booking to draw its pipeline,
 * which is fine at a few hundred rows and wasteful at ten thousand. Nothing
 * here reads a row: the database does the counting and returns a few dozen
 * numbers, so the answer costs the same in five years as it does today.
 *
 * Every figure is one the records can actually support. There is no revenue
 * here, because a booking holds no price and a quote is a note rather than a
 * figure — inventing a money chart from that would be the one thing a client
 * dashboard must never do.
 */

import { db, schema } from "@CC-City-Chauffeurs/db";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

/** How wide each bar is. */
export type Grain = "day" | "week" | "month" | "year";

/** How far back each grain looks, in its own units. Enough to show a shape, not a history. */
const WINDOW: Record<Grain, { unit: string; buckets: number }> = {
  day: { unit: "day", buckets: 30 },
  week: { unit: "week", buckets: 12 },
  month: { unit: "month", buckets: 12 },
  year: { unit: "year", buckets: 5 },
};

export type Bucket = {
  /** The first day of the period, as "YYYY-MM-DD". */
  start: string;
  enquiries: number;
  bookings: number;
};

export type Slice = { label: string; value: number };

export type Analytics = {
  grain: Grain;
  /** Oldest first, and every period in the window is present, including the empty ones. */
  buckets: Bucket[];
  headline: {
    enquiries: number;
    bookings: number;
    /** Bookings the office has confirmed, of those in the window. */
    confirmed: number;
    /** Enquiries that became a booking, as a percentage of those decided either way. */
    conversion: number | null;
  };
  /** Where the enquiries came from, most first. */
  sources: Slice[];
  /** What was asked for, most first. */
  services: Slice[];
  /** The cars asked for by name, most first. */
  vehicles: Slice[];
  /** Every enquiry in the window by its status, in the pipeline's own order. */
  outcomes: Slice[];
};

/**
 * A row per period in the window, even where nothing happened.
 *
 * `generate_series` is what makes the chart honest: a quiet fortnight has to
 * draw as two empty bars, not disappear and leave the busy ones looking
 * continuous.
 */
function periods(grain: Grain) {
  const { unit, buckets } = WINDOW[grain];
  return sql`
    select generate_series(
      date_trunc(${unit}, now()) - (${sql.raw(`interval '1 ${unit}'`)} * ${buckets - 1}),
      date_trunc(${unit}, now()),
      ${sql.raw(`interval '1 ${unit}'`)}
    ) as start
  `;
}

const since = (grain: Grain) => {
  const { unit, buckets } = WINDOW[grain];
  return sql`date_trunc(${unit}, now()) - (${sql.raw(`interval '1 ${unit}'`)} * ${buckets - 1})`;
};

/** A name for a slice, where the record holds a slug or nothing at all. */
const readable = (value: string) =>
  value
    ? value.replace(/[-_]+/g, " ").replace(/^./, (first) => first.toUpperCase())
    : "Not said";

export async function getAnalytics(grain: Grain = "month"): Promise<Analytics> {
  const { unit } = WINDOW[grain];

  const [rows, sources, services, vehicles, outcomes, confirmed] = await Promise.all([
    // The two series, per period, counted by the database and joined onto
    // every period in the window.
    db.execute(sql`
      with periods as (${periods(grain)}),
      enquiries as (
        select date_trunc(${unit}, created_at) as start, count(*)::int as total
        from ${schema.enquiry} where created_at >= ${since(grain)} group by 1
      ),
      bookings as (
        select date_trunc(${unit}, created_at) as start, count(*)::int as total
        from ${schema.booking} where created_at >= ${since(grain)} group by 1
      )
      select to_char(periods.start, 'YYYY-MM-DD') as start,
             coalesce(enquiries.total, 0) as enquiries,
             coalesce(bookings.total, 0) as bookings
      from periods
      left join enquiries on enquiries.start = periods.start
      left join bookings on bookings.start = periods.start
      order by periods.start
    `),

    db
      .select({ label: schema.enquiry.source, value: count() })
      .from(schema.enquiry)
      .where(gte(schema.enquiry.createdAt, sql`${since(grain)}`))
      .groupBy(schema.enquiry.source)
      .orderBy(desc(count())),

    db
      .select({ label: sql<string>`coalesce(${schema.enquiry.journey}->>'service', '')`, value: count() })
      .from(schema.enquiry)
      .where(gte(schema.enquiry.createdAt, sql`${since(grain)}`))
      .groupBy(sql`coalesce(${schema.enquiry.journey}->>'service', '')`)
      .orderBy(desc(count()))
      .limit(6),

    // A vehicle asked for by name, which is what the office reads. Bookings
    // with no car assigned yet are not a vehicle anybody asked for.
    db
      .select({ label: schema.vehicle.name, value: count() })
      .from(schema.booking)
      .innerJoin(schema.vehicle, eq(schema.vehicle.id, schema.booking.vehicleId))
      .where(and(gte(schema.booking.createdAt, sql`${since(grain)}`), isNotNull(schema.booking.vehicleId)))
      .groupBy(schema.vehicle.name)
      .orderBy(desc(count()))
      .limit(6),

    db
      .select({ label: schema.enquiry.status, value: count() })
      .from(schema.enquiry)
      .where(gte(schema.enquiry.createdAt, sql`${since(grain)}`))
      .groupBy(schema.enquiry.status),

    db
      .select({ value: count() })
      .from(schema.booking)
      .where(and(gte(schema.booking.createdAt, sql`${since(grain)}`), eq(schema.booking.status, "confirmed"))),
  ]);

  const buckets: Bucket[] = (rows.rows as { start: string; enquiries: number; bookings: number }[]).map((row) => ({
    start: row.start,
    enquiries: Number(row.enquiries),
    bookings: Number(row.bookings),
  }));

  const total = (slices: { value: number }[]) => slices.reduce((sum, slice) => sum + Number(slice.value), 0);
  const byStatus = (status: string) =>
    Number(outcomes.find((row) => row.label === status)?.value ?? 0);

  // Won against everything decided either way: an enquiry still open has not
  // failed to convert, it simply has not been answered yet.
  const won = byStatus("won");
  const decided = won + byStatus("lost");

  return {
    grain,
    buckets,
    headline: {
      enquiries: total(outcomes),
      bookings: buckets.reduce((sum, bucket) => sum + bucket.bookings, 0),
      confirmed: Number(confirmed[0]?.value ?? 0),
      conversion: decided ? Math.round((won / decided) * 100) : null,
    },
    sources: sources.map((row) => ({ label: readable(row.label), value: Number(row.value) })),
    services: services.map((row) => ({ label: readable(row.label), value: Number(row.value) })),
    vehicles: vehicles.map((row) => ({ label: row.label, value: Number(row.value) })),
    outcomes: outcomes.map((row) => ({ label: readable(row.label), value: Number(row.value) })),
  };
}
