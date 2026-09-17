"use client";

import { useState } from "react";

import { adminRoutes } from "@/components/admin/shell/routes";
import { Tag } from "@/components/admin/ui/badge";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { DataTable, rowLinkClass, type Column } from "@/components/admin/ui/table";
import { FilterSelect, ResultCount, SearchField, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatRelative } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getCustomers } from "@/lib/api/operations";
import { customerTypes, labelFor } from "@CC-City-Chauffeurs/core";
import type { CustomerSummary, CustomerType } from "@CC-City-Chauffeurs/core";

export function CustomerList() {
  const { data, loading, error, reload } = useCmsQuery("customers:list", getCustomers);
  const [type, setType] = useState<CustomerType | "all">("all");
  const [query, setQuery] = useState("");

  const customers = data ?? [];
  const filtered = customers.filter((customer) => {
    if (type !== "all" && customer.type !== type) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [customer.name, customer.company, customer.email, customer.phone].some((value) => value.toLowerCase().includes(needle));
  });

  const columns: Column<CustomerSummary>[] = [
    {
      id: "name",
      header: "Name",
      sortValue: (customer) => customer.name,
      cell: (customer) => (
        <div>
          <GuardedLink href={adminRoutes.customer(customer.id)} className={rowLinkClass}>
            {customer.name}
          </GuardedLink>
          {customer.company ? <p className="mt-0.5 text-[0.75rem] text-white/50">{customer.company}</p> : null}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (customer) => customer.type,
      cell: (customer) => <Tag>{labelFor(customerTypes, customer.type)}</Tag>,
    },
    {
      id: "contact",
      header: "Contact",
      minWidth: "lg",
      cell: (customer) => (
        <span className="text-[0.8125rem] text-white/70">
          {customer.phone}
          <span className="block text-white/50">{customer.email}</span>
        </span>
      ),
    },
    {
      id: "enquiries",
      header: "Enquiries",
      align: "right",
      sortValue: (customer) => customer.enquiryCount,
      cell: (customer) => <span className="tabular-nums">{customer.enquiryCount}</span>,
    },
    {
      id: "bookings",
      header: "Bookings",
      align: "right",
      sortValue: (customer) => customer.bookingCount,
      cell: (customer) => <span className="tabular-nums">{customer.bookingCount}</span>,
    },
    {
      id: "activity",
      header: "Last activity",
      sortValue: (customer) => customer.lastActivityAt,
      cell: (customer) => <span className="text-[0.8125rem] text-white/60">{formatRelative(customer.lastActivityAt)}</span>,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Operations"
        title="Customers"
        description="Everyone who has enquired or booked, with their history in one place."
      />

      <Toolbar className="mt-6">
        <SearchField label="Search customers" placeholder="Name, company, email, phone" value={query} onChange={setQuery} />
        <FilterSelect label="Filter by type" allLabel="All types" value={type} onChange={setType} options={customerTypes} className="sm:w-40" />
        {data ? <ResultCount count={filtered.length} total={customers.length} noun={["customer", "customers"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading customers" />
      ) : !filtered.length ? (
        <EmptyState title="No customers match" body="Try another type or search." />
      ) : (
        <DataTable
          caption="Customers"
          rows={filtered}
          columns={columns}
          rowKey={(customer) => customer.id}
          initialSort={{ id: "activity", direction: "desc" }}
          renderCard={(customer) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <GuardedLink href={adminRoutes.customer(customer.id)} className={rowLinkClass}>
                  {customer.name}
                </GuardedLink>
                <Tag>{labelFor(customerTypes, customer.type)}</Tag>
              </div>
              <p className="mt-1 text-[0.75rem] text-white/55">
                {customer.enquiryCount} {customer.enquiryCount === 1 ? "enquiry" : "enquiries"} · {customer.bookingCount}{" "}
                {customer.bookingCount === 1 ? "booking" : "bookings"} · {formatRelative(customer.lastActivityAt)}
              </p>
            </div>
          )}
        />
      )}
    </PageBody>
  );
}
