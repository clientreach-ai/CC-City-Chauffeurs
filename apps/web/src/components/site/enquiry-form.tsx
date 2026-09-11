"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { contact, whatsappUrl } from "@/content/site";

const serviceOptions = [
  "Private chauffeur",
  "Airport transfer",
  "Corporate travel",
  "Wedding",
  "Event or occasion",
  "City to city",
  "Roadshow",
  "Tour or sightseeing",
  "School or family run",
  "Supercar experience (chauffeur-driven)",
  "Supercar hire (self drive)",
  "Something else",
];

const vehicleOptions = [
  "No preference — suggest one",
  "Rolls-Royce Cullinan",
  "Rolls-Royce Ghost",
  "Bentley Flying Spur",
  "Mercedes S-Class",
  "Range Rover Vogue",
  "Mercedes V-Class",
  "Mercedes G-Wagon",
  "Bentley Bentayga",
  "Lamborghini Urus",
  "Lamborghini Huracán",
  "Lamborghini Revuelto",
];

const fieldClass =
  "w-full appearance-none rounded-none border-x-0 border-t-0 border-b border-hairline bg-transparent px-0 py-3 font-[family-name:var(--font-ui)] text-[0.9375rem] text-white placeholder:text-white/25 focus:border-white focus:outline-none transition-colors duration-500";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label-xs block text-white/40">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Group({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-hairline pt-7">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-baseline gap-4 pb-6">
        <span className="label-xs text-silver">{index}</span>
        <span className="label-xs text-white/50">{title}</span>
      </div>
      {children}
    </fieldset>
  );
}

/**
 * The visual and behavioural foundation for a faster quote flow. There is no
 * backend yet — the form composes the enquiry and hands it to WhatsApp (how
 * enquiries arrive today) or to email, so nothing is lost while the booking
 * and pricing engine is built.
 *
 * `variant="short"` is the homepage band; `variant="full"` is the quote page.
 */
export function EnquiryForm({
  variant = "short",
  defaultService,
  submitLabel = "Send via WhatsApp",
}: {
  variant?: "short" | "full";
  defaultService?: string;
  submitLabel?: string;
}) {
  const full = variant === "full";
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    service: defaultService ?? serviceOptions[0],
    date: "",
    time: "",
    pickup: "",
    destination: "",
    passengers: "",
    luggage: "",
    vehicle: vehicleOptions[0],
    notes: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const composeMessage = () => {
    const lines = [
      full ? "Quote request — City Chauffeurs" : "Chauffeur enquiry — City Chauffeurs",
      "",
      `Name: ${form.name || "—"}`,
      `Phone: ${form.phone || "—"}`,
      full && form.email ? `Email: ${form.email}` : "",
      `Service: ${form.service}`,
      `Date: ${form.date || "—"}${form.time ? ` at ${form.time}` : ""}`,
      `Pick-up: ${form.pickup || "—"}`,
      `Destination: ${form.destination || "—"}`,
      full ? `Passengers: ${form.passengers || "—"}` : "",
      full && form.luggage ? `Luggage: ${form.luggage}` : "",
      full ? `Vehicle: ${form.vehicle}` : "",
      form.notes ? `Notes: ${form.notes}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.open(whatsappUrl(composeMessage()), "_blank", "noopener,noreferrer");
    setSent(true);
  };

  const mailtoHref = `${contact.emailHref}?subject=${encodeURIComponent(
    full ? "Quote request" : "Chauffeur enquiry",
  )}&body=${encodeURIComponent(composeMessage())}`;

  const you = (
    <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
      <Field label="Name">
        <input
          required
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className={fieldClass}
        />
      </Field>

      <Field label="Phone">
        <input
          required
          type="tel"
          value={form.phone}
          onChange={(e) => set("phone")(e.target.value)}
          placeholder="Best number to reach you"
          autoComplete="tel"
          className={fieldClass}
        />
      </Field>

      {full ? (
        <Field label="Email" className="sm:col-span-2">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="For a written quotation"
            autoComplete="email"
            className={fieldClass}
          />
        </Field>
      ) : null}
    </div>
  );

  const journey = (
    <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
      <Field label="Service">
        <select
          value={form.service}
          onChange={(e) => set("service")(e.target.value)}
          className={`${fieldClass} cursor-pointer`}
        >
          {serviceOptions.map((option) => (
            <option key={option} value={option} className="bg-ink text-white">
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Date">
        <input
          type="date"
          value={form.date}
          onChange={(e) => set("date")(e.target.value)}
          className={`${fieldClass} scheme-dark`}
        />
      </Field>

      {full ? (
        <Field label="Time">
          <input
            type="time"
            value={form.time}
            onChange={(e) => set("time")(e.target.value)}
            className={`${fieldClass} scheme-dark`}
          />
        </Field>
      ) : null}

      <Field label="Pick-up" className={full ? "" : ""}>
        <input
          value={form.pickup}
          onChange={(e) => set("pickup")(e.target.value)}
          placeholder="Address, hotel or airport"
          className={fieldClass}
        />
      </Field>

      <Field label="Destination" className={full ? "sm:col-span-2" : ""}>
        <input
          value={form.destination}
          onChange={(e) => set("destination")(e.target.value)}
          placeholder="Address, or hours as directed"
          className={fieldClass}
        />
      </Field>
    </div>
  );

  const requirements = (
    <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
      <Field label="Passengers">
        <input
          inputMode="numeric"
          value={form.passengers}
          onChange={(e) => set("passengers")(e.target.value)}
          placeholder="How many travelling"
          className={fieldClass}
        />
      </Field>

      <Field label="Luggage">
        <input
          value={form.luggage}
          onChange={(e) => set("luggage")(e.target.value)}
          placeholder="Cases, or none"
          className={fieldClass}
        />
      </Field>

      <Field label="Vehicle" className="sm:col-span-2">
        <select
          value={form.vehicle}
          onChange={(e) => set("vehicle")(e.target.value)}
          className={`${fieldClass} cursor-pointer`}
        >
          {vehicleOptions.map((option) => (
            <option key={option} value={option} className="bg-ink text-white">
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Anything else" className="sm:col-span-2">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="Timings, child seats, multiple stops, special requirements"
          className={`${fieldClass} resize-none`}
        />
      </Field>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="w-full">
      {full ? (
        <div className="flex flex-col gap-12">
          <Group index="01" title="Who we are quoting for">
            {you}
          </Group>
          <Group index="02" title="The journey">
            {journey}
          </Group>
          <Group index="03" title="Requirements">
            {requirements}
          </Group>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {you}
          {journey}
          <Field label="Anything else">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
              placeholder="Passengers, luggage, timings, special requirements"
              className={`${fieldClass} resize-none`}
            />
          </Field>
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">
        <button type="submit" className="btn-ghost btn-on-dark">
          {submitLabel}
        </button>
        <a href={mailtoHref} className="label-xs link-quiet text-white/60 hover:text-white">
          Or send it by email
        </a>
      </div>

      <p className="label-xs mt-6 max-w-[60ch] text-white/40" role="status" aria-live="polite">
        {sent
          ? `WhatsApp should have opened with your enquiry ready to send. If it did not, call us on ${contact.phoneDisplay}.`
          : "All enquiries are handled in strict confidence. Nothing is submitted until you send the message."}
      </p>
    </form>
  );
}
