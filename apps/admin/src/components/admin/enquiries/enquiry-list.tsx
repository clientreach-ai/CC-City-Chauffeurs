"use client";

import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, ExternalLink, MessageSquareText, PoundSterling } from "lucide-react";
import { useEffect, useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader, SampleDataNotice } from "@/components/admin/ui/page";
import { DataTable, rowLinkClass, type Column } from "@/components/admin/ui/table";
import { FilterSelect, ResultCount, SearchField, SegmentedFilter, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatAge, formatShortDate, formatWhen } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getEnquiries } from "@/lib/api/operations";
import { enquirySources, enquiryStatuses, labelFor } from "@CC-City-Chauffeurs/core";
import type { Enquiry, EnquiryStatus } from "@CC-City-Chauffeurs/core";

import { changeStatus, LostDialog, QuoteDialog } from "./enquiry-actions";

export function EnquiryList() {
  const router = useRouter();
  const { can } = usePreferences();
  const { serviceLabel, services } = useLookups();
  const { data, loading, error, reload } = useCmsQuery("enquiries:list", getEnquiries);
  const [status, setStatus] = useState<EnquiryStatus | "all">("all");
  const [service, setService] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [quoting, setQuoting] = useState<Enquiry | null>(null);
  const [losing, setLosing] = useState<Enquiry | null>(null);

  // Links from the dashboard carry ?status=; read once after arrival so the
  // page itself can stay static.
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("status");
    if (enquiryStatuses.some((option) => option.value === value)) setStatus(value as EnquiryStatus);
  }, []);

  const enquiries = data ?? [];
  const filtered = enquiries.filter((enquiry) => {
    if (status !== "all" && enquiry.status !== status) return false;
    if (service !== "all" && enquiry.journey.service !== service) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [enquiry.contact.name, enquiry.reference, enquiry.journey.pickup, enquiry.journey.dropoff, enquiry.contact.phone, enquiry.contact.email]
      .some((value) => value.toLowerCase().includes(needle));
  });

  const canEdit = can("operations.edit");

  const menu = (enquiry: Enquiry): MenuAction[] => [
    { label: "Open", icon: <ExternalLink />, onSelect: () => router.push(adminRoutes.enquiry(enquiry.id)) },
    "separator",
    ...(enquiry.status === "new"
      ? [{ label: "Mark contacted", icon: <MessageSquareText />, onSelect: () => void changeStatus(enquiry, "contacted"), disabled: !canEdit } as MenuAction]
      : []),
    { label: enquiry.quote ? "Update quote" : "Record quote", icon: <PoundSterling />, onSelect: () => setQuoting(enquiry), disabled: !canEdit },
    ...(enquiry.status !== "won" ? [{ label: "Mark won", icon: <CircleCheck />, onSelect: () => void changeStatus(enquiry, "won"), disabled: !canEdit } as MenuAction] : []),
    ...(enquiry.status !== "lost" ? [{ label: "Mark lost", icon: <CircleX />, onSelect: () => setLosing(enquiry), disabled: !canEdit } as MenuAction] : []),
  ];

  const route = (enquiry: Enquiry) => [enquiry.journey.pickup, enquiry.journey.dropoff].filter(Boolean).join(" → ") || "—";

  const columns: Column<Enquiry>[] = [
    {
      id: "customer",
      header: "Customer",
      sortValue: (enquiry) => enquiry.contact.name,
      cell: (enquiry) => (
        <div className="min-w-0">
          <GuardedLink href={adminRoutes.enquiry(enquiry.id)} className={rowLinkClass}>
            {enquiry.contact.name}
          </GuardedLink>
          <p className="mt-0.5 text-[0.75rem] text-white/50">
            {enquiry.reference} · {labelFor(enquirySources, enquiry.source)}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      sortValue: (enquiry) => serviceLabel(enquiry.journey.service),
      cell: (enquiry) => <span className="text-white/80">{serviceLabel(enquiry.journey.service)}</span>,
    },
    {
      id: "journey",
      header: "Journey",
      minWidth: "lg",
      cell: (enquiry) => <span className="line-clamp-2 max-w-[28ch] text-[0.8125rem] text-white/65">{route(enquiry)}</span>,
    },
    {
      id: "date",
      header: "Date",
      sortValue: (enquiry) => enquiry.journey.date || "9999",
      cell: (enquiry) => (
        <span className="text-[0.8125rem] whitespace-nowrap tabular-nums">
          {formatShortDate(enquiry.journey.date)}
          {enquiry.journey.time ? <span className="block text-white/50">{enquiry.journey.time}</span> : null}
        </span>
      ),
    },
    {
      id: "received",
      header: "Received",
      minWidth: "xl",
      sortValue: (enquiry) => enquiry.createdAt,
      cell: (enquiry) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-white/65">
          {formatWhen(enquiry.createdAt)}
          {enquiry.status === "new" ? <span className="block text-white">Waiting {formatAge(enquiry.createdAt)}</span> : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (enquiry) => enquiryStatuses.findIndex((option) => option.value === enquiry.status),
      cell: (enquiry) => <StatusBadge kind="enquiry" value={enquiry.status} />,
    },
  ];

  const counts = Object.fromEntries(enquiryStatuses.map((option) => [option.value, enquiries.filter((e) => e.status === option.value).length]));

  return (
    <PageBody>
      <PageHeader
        eyebrow="Operations"
        title="Enquiries"
        description="Every enquiry from first message to won or lost — what needs a reply, what has been quoted, and why work was lost."
      />
      <SampleDataNotice />

      <SegmentedFilter
        label="Status"
        value={status}
        onChange={setStatus}
        className="mt-6 mb-5"
        options={[{ value: "all", label: "All", count: enquiries.length }, ...enquiryStatuses.map((option) => ({ ...option, count: counts[option.value] }))]}
      />

      <Toolbar>
        <SearchField label="Search enquiries" placeholder="Name, reference, place, phone" value={query} onChange={setQuery} />
        <FilterSelect label="Filter by service" allLabel="All services" value={service} onChange={setService} options={services} className="sm:w-60" />
        {data ? <ResultCount count={filtered.length} total={enquiries.length} noun={["enquiry", "enquiries"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading enquiries" />
      ) : !filtered.length ? (
        <EmptyState
          title={status === "new" && !query && service === "all" ? "Nothing waiting" : "No enquiries match"}
          body={status === "new" && !query && service === "all" ? "Every enquiry has been answered." : "Try another status, service or search."}
        />
      ) : (
        <DataTable
          caption="Enquiries"
          rows={filtered}
          columns={columns}
          rowKey={(enquiry) => enquiry.id}
          initialSort={{ id: "received", direction: "desc" }}
          actions={(enquiry) => <ActionMenu label={`Actions for ${enquiry.reference}, ${enquiry.contact.name}`} actions={menu(enquiry)} />}
          renderCard={(enquiry) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <GuardedLink href={adminRoutes.enquiry(enquiry.id)} className={rowLinkClass}>
                  {enquiry.contact.name}
                </GuardedLink>
                <StatusBadge kind="enquiry" value={enquiry.status} />
              </div>
              <p className="mt-1 text-[0.8125rem] text-white/75">{serviceLabel(enquiry.journey.service)}</p>
              <p className="mt-0.5 text-[0.75rem] text-white/55">{route(enquiry)}</p>
              <p className="mt-1.5 text-[0.75rem] text-white/50">
                {formatWhen(enquiry.createdAt)}
                {enquiry.status === "new" ? ` · waiting ${formatAge(enquiry.createdAt)}` : ""}
              </p>
            </div>
          )}
        />
      )}

      <QuoteDialog enquiry={quoting} onClose={() => setQuoting(null)} />
      <LostDialog enquiry={losing} onClose={() => setLosing(null)} />
    </PageBody>
  );
}
