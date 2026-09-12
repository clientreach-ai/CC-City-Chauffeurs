"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { useLookups } from "@/components/admin/lookups";
import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge, Tag } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { ChoiceCards, Field, FieldRow, TextArea, TextInput } from "@/components/admin/ui/form";
import { DefinitionList, ErrorState, LoadingBlock, PageBody, PageHeader, Panel, SampleDataNotice } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useLeaveGuard, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { formatDate, formatRelative, formatShortDate } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { getCustomer, updateCustomer } from "@/lib/cms/repositories/operations";
import { customerTypes, labelFor } from "@/lib/cms/status";
import type { Customer, CustomerInput } from "@/lib/cms/types";
import { CmsNotFoundError, CmsValidationError, type FieldErrors } from "@/lib/cms/validation";

export function CustomerDetail({ id }: { id: string }) {
  const { can } = usePreferences();
  const { serviceLabel, vehicleName } = useLookups();
  const guard = useLeaveGuard();
  const { data, loading, error, reload } = useCmsQuery(`customer:${id}`, () => getCustomer(id));
  const [editing, setEditing] = useState(false);

  if (error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Customers", href: adminRoutes.customers }, { label: "Not found" }]} title="Customer not found" />
        <ErrorState error={error} onRetry={error instanceof CmsNotFoundError ? undefined : reload} />
      </PageBody>
    );
  }
  if (loading || !data) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "Customers", href: adminRoutes.customers }, { label: "Loading" }]} title="Loading…" />
        <LoadingBlock label="Loading the customer" />
      </PageBody>
    );
  }

  const { customer, enquiries, bookings } = data;

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "Customers", href: adminRoutes.customers }, { label: customer.name }]}
        title={customer.name}
        meta={
          <>
            <Tag>{labelFor(customerTypes, customer.type)}</Tag>
            {customer.company ? <span className="text-[0.8125rem] text-white/60">{customer.company}</span> : null}
            <span className="text-[0.8125rem] text-white/55">Last activity {formatRelative(customer.lastActivityAt)}</span>
          </>
        }
        actions={
          <Button size="sm" disabled={!can("operations.edit")} onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit details
          </Button>
        }
      />
      <SampleDataNotice />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:gap-12">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="customer-contact">
            <h2 id="customer-contact" className="label-xs mb-3 text-white/70">
              Contact
            </h2>
            <DefinitionList
              items={[
                { label: "Phone", value: customer.phone },
                { label: "Email", value: customer.email },
                { label: "Customer since", value: formatDate(customer.createdAt) },
              ]}
            />
          </section>
          <Panel title="Notes">
            <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-white/80">
              {customer.notes || <span className="text-white/50">No notes. Preferences — a favourite vehicle, a usual pick-up — belong here.</span>}
            </p>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="customer-enquiries">
            <h2 id="customer-enquiries" className="label-xs mb-3 text-white/70">
              Enquiries <span className="text-white/45 tabular-nums">· {enquiries.length}</span>
            </h2>
            {enquiries.length ? (
              <ul className="border-t border-hairline">
                {enquiries.map((enquiry) => (
                  <li key={enquiry.id} className="border-b border-hairline">
                    <GuardedLink
                      href={adminRoutes.enquiry(enquiry.id)}
                      className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-white/2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] text-white">{serviceLabel(enquiry.journey.service)}</span>
                        <span className="block text-[0.75rem] text-white/50">
                          {enquiry.reference} · for {formatShortDate(enquiry.journey.date)} · received {formatRelative(enquiry.createdAt)}
                        </span>
                      </span>
                      <StatusBadge kind="enquiry" value={enquiry.status} />
                    </GuardedLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.875rem] text-white/55">No enquiries.</p>
            )}
          </section>

          <section aria-labelledby="customer-bookings">
            <h2 id="customer-bookings" className="label-xs mb-3 text-white/70">
              Bookings <span className="text-white/45 tabular-nums">· {bookings.length}</span>
            </h2>
            {bookings.length ? (
              <ul className="border-t border-hairline">
                {bookings.map((booking) => (
                  <li key={booking.id} className="border-b border-hairline">
                    <GuardedLink
                      href={adminRoutes.booking(booking.id)}
                      className="flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-white/2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] text-white">
                          {formatShortDate(booking.date)} · {booking.time}
                        </span>
                        <span className="block text-[0.75rem] text-white/50">
                          {booking.reference} · {serviceLabel(booking.service)}
                          {booking.vehicleId ? ` · ${vehicleName(booking.vehicleId)}` : ""}
                        </span>
                      </span>
                      <StatusBadge kind="booking" value={booking.status} />
                    </GuardedLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.875rem] text-white/55">No bookings.</p>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={editing}
        onClose={async () => {
          if (await guard.confirmLeave()) setEditing(false);
        }}
        title="Edit customer"
        variant="sheet"
        width="34rem"
      >
        {editing ? <CustomerForm customer={customer} onDone={() => setEditing(false)} /> : null}
      </Dialog>
    </PageBody>
  );
}

function CustomerForm({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const initial: CustomerInput = {
    name: customer.name,
    type: customer.type,
    company: customer.company,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);

  const submit = async () => {
    setSaving(true);
    try {
      await updateCustomer(customer.id, form);
      notify.success("Customer saved");
      onDone();
    } catch (err) {
      if (err instanceof CmsValidationError) setErrors(err.fields);
      else notify.error("Not saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      <Field label="Name" required error={errors.name}>
        {(control) => <TextInput {...control} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
      </Field>
      <ChoiceCards legend="Type" options={customerTypes} value={form.type} onChange={(type) => setForm({ ...form, type })} />
      <Field label="Company" description="For corporate and event customers.">
        {(control) => <TextInput {...control} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />}
      </Field>
      <FieldRow>
        <Field label="Phone" error={errors.phone}>
          {(control) => <TextInput {...control} type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(control) => <TextInput {...control} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />}
        </Field>
      </FieldRow>
      <Field label="Notes" error={errors.notes} description="Internal only.">
        {(control) => <TextArea {...control} rows={5} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />}
      </Field>
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} disabled={!dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}
