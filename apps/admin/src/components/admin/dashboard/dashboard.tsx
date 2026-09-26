"use client";

import type { Route } from "next";
import { ArrowRight, Plus } from "lucide-react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { ButtonLink } from "@/components/admin/ui/button";
import { ErrorState, PageBody, PageHeader, Panel, Skeleton } from "@/components/admin/ui/page";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatAge, formatShortDate, formatWhen } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getOverview, type Overview } from "@/lib/api/operations";
import { getConversations } from "@/lib/api/whatsapp";

import { Insights } from "./insights";
import type { Enquiry } from "@CC-City-Chauffeurs/core";

const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/**
 * Customers on WhatsApp who have been told a member of the team will reply.
 * Shown only when there are any, and only to somebody who can act on it.
 */
function WaitingOnWhatsApp({ enabled }: { enabled: boolean }) {
  const { data } = useCmsQuery(
    "dashboard:whatsapp-waiting",
    async () => (enabled ? (await getConversations("human_requested").catch(() => [])).length : 0),
    { refreshMs: 30_000 },
  );
  const waiting = data ?? 0;
  if (!waiting) return null;

  return (
    <GuardedLink
      href={adminRoutes.whatsapp}
      className="group flex items-center justify-between gap-4 border-t border-hairline py-4 transition-colors hover:bg-white/3"
    >
      <span className="label-xs text-white">
        {waiting === 1
          ? "One customer is waiting for a person on WhatsApp"
          : `${waiting} customers are waiting for a person on WhatsApp`}
      </span>
      <span className="label-xs flex items-center gap-2 text-white/60 group-hover:text-white">
        Open WhatsApp
        <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </GuardedLink>
  );
}

function route(enquiry: Enquiry) {
  const { pickup, dropoff } = enquiry.journey;
  return [pickup, dropoff].filter(Boolean).join(" → ");
}

export function Dashboard() {
  const { can } = usePreferences();
  const { data, loading, error, reload } = useCmsQuery("overview", getOverview);
  const operations = can("operations.view");

  return (
    <PageBody>
      <PageHeader
        eyebrow={longDate.format(new Date())}
        title="Overview"
        description={
          operations
            ? "What needs a reply, what is on the road, and the state of the website."
            : "The state of the website content."
        }
        actions={
          <>
            <ButtonLink href={adminRoutes.newVehicle} size="sm">
              <Plus aria-hidden />
              Add vehicle
            </ButtonLink>
            {operations ? (
              <ButtonLink href={`${adminRoutes.enquiries}?status=new`} variant="primary" size="sm">
                Open new enquiries
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {operations ? <WaitingOnWhatsApp enabled={operations} /> : null}

      {operations ? <Pipeline data={data} loading={loading} /> : null}

      {operations ? <Insights /> : null}

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        {operations ? (
          <div className="flex flex-col gap-6 xl:col-span-7">
            <NeedsReply data={data} loading={loading} />
            <RecentEnquiries data={data} loading={loading} />
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-6", operations ? "xl:col-span-5" : "xl:col-span-12 xl:grid xl:grid-cols-2")}>
          {operations ? <UpcomingBookings data={data} loading={loading} /> : null}
          <WebsiteStatus data={data} loading={loading} />
          <ClientGaps data={data} loading={loading} />
        </div>
      </div>
    </PageBody>
  );
}

type Props = { data: Overview | undefined; loading: boolean };

function Pipeline({ data, loading }: Props) {
  return (
    <section aria-labelledby="pipeline-title">
      <div className="flex items-baseline justify-between gap-4 border-t border-hairline py-4">
        <h2 id="pipeline-title" className="label-xs text-white/70">
          Enquiry pipeline
        </h2>
        <GuardedLink href={adminRoutes.enquiries} className="label-xs text-white/60 transition-colors hover:text-white">
          All enquiries
        </GuardedLink>
      </div>
      <ol className="grid grid-cols-2 border-t border-l border-hairline sm:grid-cols-3 lg:grid-cols-5">
        {(data?.pipeline ?? Array.from({ length: 5 }, () => null)).map((stage, i) => (
          <li key={stage?.value ?? i} className="border-r border-b border-hairline">
            {stage ? (
              <GuardedLink
                href={`${adminRoutes.enquiries}?status=${stage.value}` as Route}
                className="group flex h-full flex-col gap-2 p-4 transition-colors hover:bg-white/3 sm:p-5"
              >
                <span className="flex items-center justify-between">
                  <span className="label-xs text-white/60 group-hover:text-white">{stage.label}</span>
                  <span className="label-xs text-white/40">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span
                  className={cn(
                    "font-display text-[2.75rem] leading-none font-light tabular-nums",
                    stage.value === "new" && stage.count > 0 ? "text-white" : "text-white/80",
                  )}
                >
                  {stage.count}
                </span>
                <span className="text-[0.75rem] text-white/50">{stage.note}</span>
              </GuardedLink>
            ) : (
              <div className="flex flex-col gap-3 p-5" aria-hidden>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            )}
          </li>
        ))}
      </ol>
      {loading && !data ? <span className="sr-only" role="status">Loading the pipeline…</span> : null}
    </section>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
      ))}
    </div>
  );
}

function NeedsReply({ data, loading }: Props) {
  const { serviceLabel } = useLookups();
  const waiting = data?.unanswered ?? [];
  return (
    <Panel
      title={
        <h2 className="label-xs flex items-center gap-2.5 text-white/70">
          Needs a reply
          {waiting.length ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center bg-white px-1.5 text-[0.6875rem] text-ink tabular-nums">
              {waiting.length}
            </span>
          ) : null}
        </h2>
      }
      action={<span className="text-[0.75rem] text-white/50">Oldest first</span>}
      bodyClassName="p-0"
    >
      {loading ? (
        <div className="p-5">
          <PanelSkeleton />
        </div>
      ) : waiting.length ? (
        <ul>
          {waiting.map((enquiry) => (
            <li key={enquiry.id} className="border-b border-hairline last:border-b-0">
              <GuardedLink
                href={adminRoutes.enquiry(enquiry.id)}
                className="group flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-white/3 sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] text-white">{enquiry.contact.name}</span>
                  <span className="mt-1 block text-[0.8125rem] text-white/65">{serviceLabel(enquiry.journey.service)}</span>
                  {route(enquiry) ? <span className="mt-0.5 block truncate text-[0.8125rem] text-white/50">{route(enquiry)}</span> : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-[0.75rem] text-white tabular-nums">Waiting {formatAge(enquiry.createdAt)}</span>
                  <span className="text-[0.75rem] text-white/50">{formatWhen(enquiry.createdAt)}</span>
                </span>
              </GuardedLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-[0.875rem] text-white/60">Nothing is waiting for a reply.</p>
      )}
    </Panel>
  );
}

function RecentEnquiries({ data, loading }: Props) {
  const { serviceLabel } = useLookups();
  return (
    <Panel
      title="Recent enquiries"
      action={
        <GuardedLink href={adminRoutes.enquiries} className="label-xs flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
          View all <ArrowRight className="size-3" aria-hidden />
        </GuardedLink>
      }
      bodyClassName="p-0"
    >
      {loading ? (
        <div className="p-5">
          <PanelSkeleton rows={4} />
        </div>
      ) : (
        <ul>
          {data?.recent.map((enquiry) => (
            <li key={enquiry.id} className="border-b border-hairline last:border-b-0">
              <GuardedLink
                href={adminRoutes.enquiry(enquiry.id)}
                className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-white/3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] text-white">{enquiry.contact.name}</span>
                  <span className="block text-[0.75rem] text-white/50">{formatWhen(enquiry.createdAt)}</span>
                </span>
                <span className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                  <span className="block truncate text-[0.8125rem] text-white/75">{serviceLabel(enquiry.journey.service)}</span>
                  <span className="block truncate text-[0.75rem] text-white/50">{route(enquiry) || "—"}</span>
                </span>
                <StatusBadge kind="enquiry" value={enquiry.status} />
              </GuardedLink>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function UpcomingBookings({ data, loading }: Props) {
  const { serviceLabel, vehicleName } = useLookups();
  const names = new Map(data?.customers.map((customer) => [customer.id, customer.name]));
  return (
    <Panel
      title="Upcoming bookings"
      action={
        <GuardedLink href={adminRoutes.bookings} className="label-xs flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
          All bookings <ArrowRight className="size-3" aria-hidden />
        </GuardedLink>
      }
      bodyClassName="p-0"
    >
      {loading ? (
        <div className="p-5">
          <PanelSkeleton />
        </div>
      ) : data?.upcoming.length ? (
        <ul>
          {data.upcoming.map((booking) => (
            <li key={booking.id} className="border-b border-hairline last:border-b-0">
              <GuardedLink
                href={adminRoutes.booking(booking.id)}
                className="flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-white/3 sm:px-5"
              >
                <span className="w-24 shrink-0">
                  <span className="block text-[0.8125rem] whitespace-nowrap text-white">{formatShortDate(booking.date)}</span>
                  <span className="block text-[0.75rem] text-white/55 tabular-nums">{booking.time}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] text-white">
                    {booking.customerId ? names.get(booking.customerId) : "—"}
                  </span>
                  <span className="block truncate text-[0.75rem] text-white/55">
                    {serviceLabel(booking.service)}
                    {booking.vehicleId ? ` · ${vehicleName(booking.vehicleId)}` : ""}
                  </span>
                </span>
                <StatusBadge kind="booking" value={booking.status} />
              </GuardedLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-[0.875rem] text-white/60">No bookings coming up.</p>
      )}
    </Panel>
  );
}

function WebsiteStatus({ data, loading }: Props) {
  const rows: { label: string; href: Route; value: string; note: string }[] = data
    ? [
        {
          label: "Vehicles",
          href: adminRoutes.fleet,
          value: `${data.content.vehicles.published} published`,
          note: [
            data.content.vehicles.draft ? `${data.content.vehicles.draft} draft` : "",
            data.content.vehicles.archived ? `${data.content.vehicles.archived} archived` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "No drafts",
        },
        {
          label: "Services",
          href: adminRoutes.services,
          value: `${data.content.services.published} published`,
          note: data.content.services.draft ? `${data.content.services.draft} draft` : "No drafts",
        },
        {
          label: "Gallery",
          href: adminRoutes.gallery,
          value: `${data.content.gallery.published} photographs`,
          note: data.content.gallery.hidden ? `${data.content.gallery.hidden} hidden` : "None hidden",
        },
        {
          label: "Testimonials",
          href: adminRoutes.testimonials,
          value: `${data.content.testimonials.published} published`,
          note: data.content.testimonials.pending
            ? `${data.content.testimonials.pending} awaiting review`
            : "None awaiting review",
        },
      ]
    : [];

  return (
    <Panel title="Website content" bodyClassName="p-0">
      {loading ? (
        <div className="p-5">
          <PanelSkeleton rows={4} />
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.label} className="border-b border-hairline last:border-b-0">
              <GuardedLink
                href={row.href}
                className="flex items-baseline justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-white/3 sm:px-5"
              >
                <span className="label-xs text-white/60">{row.label}</span>
                <span className="text-right">
                  <span className="block text-[0.875rem] text-white tabular-nums">{row.value}</span>
                  <span className="block text-[0.75rem] text-white/50">{row.note}</span>
                </span>
              </GuardedLink>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Information only the client can supply, taken from the live records. Each
 * item clears itself as the vehicles are completed.
 */
function ClientGaps({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <Panel title="Waiting on the client">
        <PanelSkeleton />
      </Panel>
    );
  }
  const { gaps } = data;
  const items = [
    gaps.photography.length
      ? {
          title: `${gaps.photography.length} vehicles without photography`,
          detail: gaps.photography.map((v) => v.name).join(", "),
          note: "Shown on the website as “Photography to follow”.",
        }
      : null,
    gaps.capacity.length
      ? {
          title: `${gaps.capacity.length} vehicles without a confirmed capacity`,
          detail: gaps.capacity.map((v) => v.name).join(", "),
          note: "Shown as “On enquiry” until the client confirms passengers and luggage.",
        }
      : null,
    gaps.pricing
      ? {
          title: `${gaps.pricing} vehicles priced “On request”`,
          detail: "No indicative hourly rate has been given for these.",
          note: "",
        }
      : null,
    gaps.ownership
      ? {
          title: `${gaps.ownership} vehicles with ownership unconfirmed`,
          detail: "Owned or sourced from a partner — internal only, never published.",
          note: "",
        }
      : null,
  ].filter((item) => item !== null);

  return (
    <Panel title="Waiting on the client">
      {items.length ? (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.title} className="border-l border-hairline-strong pl-4">
              <p className="text-[0.875rem] text-white">{item.title}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-white/60">{item.detail}</p>
              {item.note ? <p className="mt-1 text-[0.75rem] text-white/50">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.875rem] text-white/60">Every published vehicle is complete.</p>
      )}
      <div className="mt-5">
        <ButtonLink href={adminRoutes.fleet} size="sm" variant="ghost" className="-ml-3">
          Open the fleet
          <ArrowRight aria-hidden />
        </ButtonLink>
      </div>
    </Panel>
  );
}
