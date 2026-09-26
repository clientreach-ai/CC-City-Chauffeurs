"use client";

/**
 * The business, at a glance.
 *
 * Written for the client rather than the office: four figures worth being
 * proud of, one chart of how the work arrives, and three short lists of what
 * people ask for. Nothing here is a number somebody has to act on today —
 * that is what the pipeline below it is for.
 *
 * Two decisions worth writing down.
 *
 * **The colour.** This brand is black, white and silver on purpose, so a
 * categorical palette of hues would be the one thing that made the admin look
 * like somebody else's product. The two series are separated by lightness
 * instead, which colour blindness does not touch: silver against slate
 * measures 35 ΔE apart under every simulation, and every series is named in a
 * legend and labelled where it is read, so identity never rests on colour
 * alone. That is the trade a monochrome brand makes, made deliberately.
 *
 * **The bars are HTML, not SVG.** A bar chart is a row of rectangles; div
 * elements do that natively, resize with the page, and take focus for a
 * keyboard. An SVG would have been more code and less accessible.
 *
 * **The readout is one line above the chart, not a tooltip on each bar.** A
 * tooltip floating over the bar it belongs to has to be kept inside the
 * chart, and at thirty bars on a telephone the ones at each end hang off the
 * edge. A single slot that the hovered period writes into cannot overflow
 * anything, reads the same under a mouse, a thumb and a keyboard, and says
 * what it is showing even before anybody touches it.
 */

import { useState } from "react";

import { SegmentedFilter } from "@/components/admin/ui/toolbar";
import { Skeleton } from "@/components/admin/ui/page";
import { useCmsQuery } from "@/lib/query";
import { getAnalytics, type Analytics, type Grain } from "@/lib/api/operations";

const GRAINS: readonly { value: Grain; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

/** How a period reads under each grain, on its own and in a sentence. */
const LABEL: Record<Grain, Intl.DateTimeFormatOptions> = {
  day: { day: "numeric", month: "short" },
  week: { day: "numeric", month: "short" },
  month: { month: "short" },
  year: { year: "numeric" },
};

const FULL: Record<Grain, Intl.DateTimeFormatOptions> = {
  day: { weekday: "long", day: "numeric", month: "long" },
  week: { day: "numeric", month: "long" },
  month: { month: "long", year: "numeric" },
  year: { year: "numeric" },
};

const period = (start: string, grain: Grain, style: Record<Grain, Intl.DateTimeFormatOptions>) =>
  new Intl.DateTimeFormat("en-GB", style[grain]).format(new Date(`${start}T00:00:00`));

/** A figure to be proud of, in the display face. */
function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-r border-b border-hairline p-4 sm:p-5">
      <p className="label-xs text-white/60">{label}</p>
      <p className="font-display mt-2 text-[2.75rem] leading-none font-light tabular-nums text-white">{value}</p>
      {note ? <p className="label-xs mt-2 text-white/40">{note}</p> : null}
    </div>
  );
}

/**
 * The two series, period by period.
 *
 * Every period in the window is drawn, including the empty ones: a quiet
 * fortnight that closed its own gap would make the busy weeks either side
 * look continuous.
 */
function OverTime({ data }: { data: Analytics }) {
  // Nothing hovered reads as the most recent period, so the line is never
  // empty and never asks to be hovered before it says anything.
  const [hovered, setHovered] = useState<number | null>(null);
  const tallest = Math.max(1, ...data.buckets.flatMap((bucket) => [bucket.enquiries, bucket.bookings]));
  const reading = data.buckets[hovered ?? data.buckets.length - 1];
  // A label under every bar collides at thirty of them; the ends and the
  // middle are enough to read the axis.
  const shown = new Set([0, Math.floor((data.buckets.length - 1) / 2), data.buckets.length - 1]);

  return (
    <figure className="mt-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="label-xs text-white/70">How the work arrives</h3>
        <ul className="label-xs flex items-center gap-4 text-white/60">
          <li className="flex items-center gap-2">
            <span aria-hidden className="bg-silver inline-block h-2 w-2.5" />
            Enquiries
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="bg-slate inline-block h-2 w-2.5" />
            Bookings
          </li>
        </ul>
      </figcaption>

      {reading ? (
        <p className="label-xs mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-white/70">
          <span className="text-white">{period(reading.start, data.grain, FULL)}</span>
          <span className="tabular-nums">
            {reading.enquiries} {reading.enquiries === 1 ? "enquiry" : "enquiries"}
          </span>
          <span className="tabular-nums">
            {reading.bookings} {reading.bookings === 1 ? "booking" : "bookings"}
          </span>
          {hovered === null ? <span className="text-white/40">most recent</span> : null}
        </p>
      ) : null}

      <div
        className="mt-3 flex h-44 items-end gap-[3px] border-b border-hairline sm:h-52"
        onMouseLeave={() => setHovered(null)}
      >
        {data.buckets.map((bucket, index) => {
          const when = period(bucket.start, data.grain, FULL);
          return (
            <div
              key={bucket.start}
              tabIndex={0}
              // The whole period is the hit target, which is bigger than the
              // bars and works for a thumb as well as a mouse.
              className="group flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-[4px] outline-none hover:bg-white/5 focus-visible:bg-white/5"
              aria-label={`${when}: ${bucket.enquiries} enquiries, ${bucket.bookings} bookings`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
            >
              <span
                className="bg-silver w-full max-w-3 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(bucket.enquiries && 2, (bucket.enquiries / tallest) * 100)}%` }}
              />
              <span
                className="bg-slate w-full max-w-3 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(bucket.bookings && 2, (bucket.bookings / tallest) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>

      <ol className="label-xs mt-3 flex text-white/40">
        {data.buckets.map((bucket, index) => (
          <li key={bucket.start} className="flex-1 text-center">
            {shown.has(index) ? period(bucket.start, data.grain, LABEL) : " "}
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** One list of things people asked for, longest bar first. */
function Ranked({ title, slices, empty }: { title: string; slices: Analytics["sources"]; empty: string }) {
  const most = Math.max(1, ...slices.map((slice) => slice.value));

  return (
    <figure>
      <figcaption className="label-xs border-b border-hairline pb-3 text-white/70">{title}</figcaption>
      {slices.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {slices.map((slice) => (
            <li key={slice.label}>
              <div className="label-xs flex items-baseline justify-between gap-4">
                <span className="text-white/80">{slice.label}</span>
                <span className="tabular-nums text-white/60">{slice.value}</span>
              </div>
              <div className="mt-1.5 h-1 bg-white/6">
                <div className="bg-silver h-full rounded-r-[2px]" style={{ width: `${(slice.value / most) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="label-xs mt-4 text-white/40">{empty}</p>
      )}
    </figure>
  );
}

/** The same numbers as a table, for anybody the chart does not serve. */
function Numbers({ data }: { data: Analytics }) {
  return (
    <table className="mt-6 w-full border-collapse text-left">
      <caption className="label-xs pb-3 text-left text-white/40">
        Every period in the window, as figures.
      </caption>
      <thead>
        <tr className="label-xs text-white/60">
          <th scope="col" className="border-b border-hairline py-2 font-normal">
            Period
          </th>
          <th scope="col" className="border-b border-hairline py-2 text-right font-normal">
            Enquiries
          </th>
          <th scope="col" className="border-b border-hairline py-2 text-right font-normal">
            Bookings
          </th>
        </tr>
      </thead>
      <tbody>
        {data.buckets.map((bucket) => (
          <tr key={bucket.start} className="label-xs text-white/80">
            <td className="border-b border-hairline py-2">{period(bucket.start, data.grain, FULL)}</td>
            <td className="border-b border-hairline py-2 text-right tabular-nums">{bucket.enquiries}</td>
            <td className="border-b border-hairline py-2 text-right tabular-nums">{bucket.bookings}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Insights() {
  const [grain, setGrain] = useState<Grain>("month");
  const [numbers, setNumbers] = useState(false);
  const { data, loading } = useCmsQuery(`analytics:${grain}`, () => getAnalytics(grain));

  const headline = data?.headline;
  const sinceWhen = { day: "30 days", week: "12 weeks", month: "12 months", year: "5 years" }[grain];

  return (
    <section aria-labelledby="insights-title" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline py-4">
        <h2 id="insights-title" className="label-xs text-white/70">
          The last {sinceWhen}
        </h2>
        <button
          type="button"
          onClick={() => setNumbers((shown) => !shown)}
          className="label-xs text-white/60 transition-colors hover:text-white"
          aria-pressed={numbers}
        >
          {numbers ? "Show the chart" : "Show the numbers"}
        </button>
      </div>

      <SegmentedFilter label="Period" value={grain} onChange={setGrain} options={GRAINS} className="mb-6" />

      {loading || !data || !headline ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid grid-cols-2 border-t border-l border-hairline lg:grid-cols-4">
            <Figure label="Enquiries" value={String(headline.enquiries)} />
            <Figure label="Bookings" value={String(headline.bookings)} />
            <Figure label="Confirmed" value={String(headline.confirmed)} note="by the office" />
            <Figure
              label="Enquiries won"
              value={headline.conversion === null ? "—" : `${headline.conversion}%`}
              note={headline.conversion === null ? "nothing decided yet" : "of those decided"}
            />
          </div>

          {numbers ? <Numbers data={data} /> : <OverTime data={data} />}

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Ranked title="Where they came from" slices={data.sources} empty="No enquiries in this period." />
            <Ranked title="What they asked for" slices={data.services} empty="Nothing asked for yet." />
            <Ranked title="Cars requested" slices={data.vehicles} empty="No car requested by name yet." />
          </div>
        </>
      )}
    </section>
  );
}
