"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  NO_VEHICLE_PREFERENCE,
  replyOptions,
  serviceOptions,
  type ServiceOption,
} from "@/content/enquiry";
import { contact, whatsappUrl } from "@/content/site";

/*
 * The enquiry form.
 *
 * There is no booking backend yet, and this form does not pretend otherwise:
 * it validates the brief, writes it out as a message, and hands it to
 * WhatsApp (how enquiries arrive today) or to email. Nothing is stored or
 * submitted from this page. When the backend lands, `handOff` is the single
 * place that changes — the fields, validation and states stay as they are.
 *
 * `variant="short"` is the homepage and contact band; `variant="full"` is the
 * quote page, which asks for everything a quote needs in one pass (PRD §10.1).
 */

type Variant = "short" | "full";

type FormState = {
  service: ServiceOption;
  date: string;
  time: string;
  pickup: string;
  destination: string;
  flight: string;
  passengers: string;
  luggage: string;
  vehicle: string;
  notes: string;
  name: string;
  phone: string;
  email: string;
  reply: (typeof replyOptions)[number];
};

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

const REQUIRED: Record<Variant, readonly FieldKey[]> = {
  short: ["name", "phone"],
  full: ["service", "date", "pickup", "passengers", "name", "phone"],
};

const fieldClass =
  "w-full appearance-none rounded-none border-x-0 border-t-0 border-b border-hairline bg-transparent px-0 py-3 font-ui text-[0.9375rem] text-white placeholder:text-white/45 transition-colors duration-500 focus:border-white focus:outline-none aria-invalid:border-white";

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function serviceLabel(value: ServiceOption) {
  return serviceOptions.find((option) => option.value === value)?.label ?? value;
}

/** Accepts a slug ("airport-transfers") or a label ("Airport transfer"). */
function matchService(raw: string | null): ServiceOption | undefined {
  if (!raw) return undefined;
  const needle = raw.trim().toLowerCase();
  return serviceOptions.find(
    (option) =>
      option.value === needle ||
      option.label.toLowerCase() === needle ||
      option.label.toLowerCase().startsWith(needle),
  )?.value;
}

function validate(form: FormState, variant: Variant): Errors {
  const errors: Errors = {};
  const required = REQUIRED[variant];
  const missing = (key: FieldKey) => required.includes(key) && !String(form[key]).trim();

  if (missing("name")) errors.name = "Tell us who we are quoting for.";

  if (missing("phone")) {
    errors.phone = "Add a number so we can reply — WhatsApp is fine.";
  } else if (form.phone.trim() && form.phone.replace(/[^\d]/g, "").length < 7) {
    errors.phone = "That number looks too short — check it and include the area code.";
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = "That email address does not look complete.";
  }

  if (missing("date")) {
    errors.date = "Choose the date of the booking.";
  } else if (form.date && form.date < todayISO()) {
    errors.date = "That date has passed — choose today or later.";
  }

  if (missing("pickup")) errors.pickup = "Where should we collect you? An address, hotel or airport.";

  if (missing("passengers")) {
    errors.passengers = "How many people are travelling?";
  } else if (form.passengers.trim()) {
    const n = Number(form.passengers);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      errors.passengers = "Enter a number of passengers between 1 and 50.";
    }
  }

  return errors;
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label-xs flex items-baseline justify-between gap-4">
        <span className="text-white/70">{label}</span>
        {optional ? <span className="text-white/50 normal-case tracking-normal">Optional</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="label-xs mt-2.5 normal-case tracking-normal text-white/55">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-2.5 flex gap-2 font-ui text-[0.8125rem] leading-snug text-white">
          <span aria-hidden className="mt-[0.55em] h-px w-3 shrink-0 bg-white" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Group({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-hairline pt-7">
      <legend className="float-left mb-6 flex w-full items-baseline gap-4">
        <span className="label-xs text-silver">{index}</span>
        <span className="label-xs text-white/70">{title}</span>
      </legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  );
}

export function EnquiryForm({
  variant = "short",
  defaultService,
  vehicles = [],
}: {
  variant?: Variant;
  /** Service to preselect, as a slug or a label. */
  defaultService?: string;
  /** Vehicle names for the preference list — passed in so the fleet model
   *  (and its image manifest) never reaches the client bundle. */
  vehicles?: readonly string[];
}) {
  const full = variant === "full";
  const uid = useId();
  const id = (key: string) => `${uid}-${key}`;
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<FormState>({
    service: matchService(defaultService ?? null) ?? serviceOptions[0].value,
    date: "",
    time: "",
    pickup: "",
    destination: "",
    flight: "",
    passengers: "",
    luggage: "",
    vehicle: NO_VEHICLE_PREFERENCE,
    notes: "",
    name: "",
    phone: "",
    email: "",
    reply: "WhatsApp",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"editing" | "opening" | "ready">("editing");
  const [copied, setCopied] = useState(false);

  /*
   * Links from service and fleet pages carry the answers they already know
   * (?service=, ?vehicle=, ?date=, ?passengers=). Read once after mount, so
   * the form itself is server-rendered and the page stays static.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = matchService(params.get("service"));
    const vehicleParam = params.get("vehicle")?.toLowerCase();
    const vehicle = vehicles.find((name) => name.toLowerCase() === vehicleParam);
    const date = params.get("date");
    const passengers = params.get("passengers");
    if (!service && !vehicle && !date && !passengers) return;
    setForm((previous) => ({
      ...previous,
      ...(service ? { service } : {}),
      ...(vehicle ? { vehicle } : {}),
      ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
      ...(passengers && /^\d{1,2}$/.test(passengers) ? { passengers } : {}),
    }));
    // Prefill is a one-off on arrival; later edits belong to the visitor.
  }, []);

  const set = <K extends FieldKey>(key: K) => (value: FormState[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    // Once someone has tried to send, keep the messages honest as they fix things.
    if (attempted) setErrors(validate(next, variant));
  };

  const isAirport = form.service === "airport-transfers";

  const composeMessage = () => {
    const journey = [
      `Service: ${serviceLabel(form.service)}`,
      form.date && `Date: ${form.date}${form.time ? ` at ${form.time}` : ""}`,
      form.pickup && `Pick-up: ${form.pickup}`,
      form.destination && `Destination: ${form.destination}`,
      isAirport && form.flight && `Flight: ${form.flight}`,
      form.passengers && `Passengers: ${form.passengers}`,
      form.luggage && `Luggage: ${form.luggage}`,
      full && form.vehicle !== NO_VEHICLE_PREFERENCE && `Vehicle: ${form.vehicle}`,
      form.notes && `Notes: ${form.notes}`,
    ];
    const person = [
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      form.email && `Email: ${form.email}`,
      full && `Reply by: ${form.reply}`,
    ];
    const lines = (list: (string | false)[]) => list.filter(Boolean).join("\n");
    return [
      full ? "Quote request — City Chauffeurs" : "Chauffeur enquiry — City Chauffeurs",
      lines(journey),
      lines(person),
    ].join("\n\n");
  };

  const mailtoHref = () =>
    `${contact.emailHref}?subject=${encodeURIComponent(
      full ? `Quote request — ${serviceLabel(form.service)}` : "Chauffeur enquiry",
    )}&body=${encodeURIComponent(composeMessage())}`;

  /** Validates, and on failure moves focus to the first problem. */
  const check = () => {
    setAttempted(true);
    const found = validate(form, variant);
    setErrors(found);
    if (Object.keys(found).length) {
      // After the errors render, focus the first flagged field in on-screen
      // order — not validation order, which differs between the two variants.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return false;
    }
    return true;
  };

  /** The one place that changes when a real submission endpoint exists. */
  const handOff = (channel: "whatsapp" | "email") => {
    if (channel === "email") {
      window.location.href = mailtoHref();
    } else {
      window.open(whatsappUrl(composeMessage()), "_blank", "noopener,noreferrer");
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "opening" || !check()) return;
    setStatus("opening");
    handOff("whatsapp");
    // A short hold stops a double tap opening two conversations.
    window.setTimeout(() => setStatus("ready"), 900);
  };

  const onEmail = () => {
    if (check()) {
      handOff("email");
      setStatus("ready");
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(composeMessage());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const errorCount = Object.keys(errors).length;
  const describe = (key: FieldKey, hint?: boolean) =>
    errors[key] ? `${id(key)}-error` : hint ? `${id(key)}-hint` : undefined;
  const aria = (key: FieldKey, hint?: boolean) => ({
    id: id(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": describe(key, hint),
  });
  const req = (key: FieldKey) => REQUIRED[variant].includes(key);

  // ----------------------------------------------------------------- fields

  const serviceField = (
    <Field id={id("service")} label="Service">
      <select
        {...aria("service")}
        required={req("service")}
        value={form.service}
        onChange={(e) => set("service")(e.target.value as ServiceOption)}
        className={`${fieldClass} cursor-pointer`}
      >
        {serviceOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-ink text-white">
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );

  const dateField = (
    <Field id={id("date")} label="Date" optional={!req("date")} error={errors.date}>
      <input
        {...aria("date")}
        type="date"
        min={todayISO()}
        required={req("date")}
        value={form.date}
        onChange={(e) => set("date")(e.target.value)}
        className={`${fieldClass} scheme-dark`}
      />
    </Field>
  );

  const pickupField = (
    <Field id={id("pickup")} label="Pick-up" optional={!req("pickup")} error={errors.pickup}>
      <input
        {...aria("pickup")}
        required={req("pickup")}
        autoComplete="street-address"
        value={form.pickup}
        onChange={(e) => set("pickup")(e.target.value)}
        placeholder="Address, hotel or airport"
        className={fieldClass}
      />
    </Field>
  );

  const destinationField = (
    <Field id={id("destination")} label="Destination" optional className={full ? "sm:col-span-2" : ""}>
      <input
        {...aria("destination")}
        value={form.destination}
        onChange={(e) => set("destination")(e.target.value)}
        placeholder="Address — or hours, if as directed"
        className={fieldClass}
      />
    </Field>
  );

  const nameField = (
    <Field id={id("name")} label="Name" error={errors.name}>
      <input
        {...aria("name")}
        required
        autoComplete="name"
        value={form.name}
        onChange={(e) => set("name")(e.target.value)}
        placeholder="Your name"
        className={fieldClass}
      />
    </Field>
  );

  const phoneField = (
    <Field id={id("phone")} label="Phone or WhatsApp" error={errors.phone}>
      <input
        {...aria("phone")}
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={(e) => set("phone")(e.target.value)}
        placeholder="Best number to reach you"
        className={fieldClass}
      />
    </Field>
  );

  const notesField = (
    <Field
      id={id("notes")}
      label="Anything else"
      optional
      hint={full ? "Isofix booster seats are available on request." : undefined}
      className="sm:col-span-2"
    >
      <textarea
        {...aria("notes", full)}
        rows={full ? 3 : 2}
        value={form.notes}
        onChange={(e) => set("notes")(e.target.value)}
        placeholder={
          full
            ? "Timings, additional stops, child seats, the occasion"
            : "Passengers, luggage, timings, anything we should know"
        }
        className={`${fieldClass} resize-none`}
      />
    </Field>
  );

  // ----------------------------------------------------------------- layout

  const body = full ? (
    <div className="flex flex-col gap-12">
      <Group index="01" title="The journey">
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-2">{serviceField}</div>
          {dateField}
          <Field id={id("time")} label="Pick-up time" optional>
            <input
              {...aria("time")}
              type="time"
              value={form.time}
              onChange={(e) => set("time")(e.target.value)}
              className={`${fieldClass} scheme-dark`}
            />
          </Field>
          <div className="sm:col-span-2">{pickupField}</div>
          {destinationField}
          {isAirport ? (
            <Field
              id={id("flight")}
              label="Flight number"
              optional
              hint="We track it, so a delay moves the collection with it."
            >
              <input
                {...aria("flight", true)}
                autoCapitalize="characters"
                value={form.flight}
                onChange={(e) => set("flight")(e.target.value)}
                placeholder="e.g. BA 2551"
                className={fieldClass}
              />
            </Field>
          ) : null}
        </div>
      </Group>

      <Group index="02" title="Who is travelling">
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
          <Field id={id("passengers")} label="Passengers" error={errors.passengers}>
            <input
              {...aria("passengers")}
              required
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={form.passengers}
              onChange={(e) => set("passengers")(e.target.value)}
              placeholder="How many travelling"
              className={fieldClass}
            />
          </Field>
          <Field id={id("luggage")} label="Luggage" optional>
            <input
              {...aria("luggage")}
              value={form.luggage}
              onChange={(e) => set("luggage")(e.target.value)}
              placeholder="Large cases, or none"
              className={fieldClass}
            />
          </Field>
          {vehicles.length ? (
            <Field id={id("vehicle")} label="Vehicle preference" optional className="sm:col-span-2">
              <select
                {...aria("vehicle")}
                value={form.vehicle}
                onChange={(e) => set("vehicle")(e.target.value)}
                className={`${fieldClass} cursor-pointer`}
              >
                {[NO_VEHICLE_PREFERENCE, ...vehicles].map((option) => (
                  <option key={option} value={option} className="bg-ink text-white">
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {notesField}
        </div>
      </Group>

      <Group index="03" title="How to reach you">
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
          {nameField}
          {phoneField}
          <Field
            id={id("email")}
            label="Email"
            optional
            hint="For a written quotation."
            error={errors.email}
            className="sm:col-span-2"
          >
            <input
              {...aria("email", true)}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="label-xs text-white/70">Reply by</legend>
            <div className="mt-4 flex flex-wrap gap-3">
              {replyOptions.map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name={id("reply")}
                    value={option}
                    checked={form.reply === option}
                    onChange={() => set("reply")(option)}
                    className="peer sr-only"
                  />
                  <span className="label-xs inline-flex min-h-11 items-center rounded-[2px] border border-white/25 px-5 text-white/70 transition-colors duration-500 peer-checked:border-white peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-white hover:text-white">
                    {option}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Group>
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
      {nameField}
      {phoneField}
      {serviceField}
      {dateField}
      {pickupField}
      {destinationField}
      {notesField}
    </div>
  );

  if (status === "ready") {
    return (
      <div
        className="border-t border-hairline pt-8"
        role="status"
        aria-live="polite"
      >
        <p className="label-xs text-silver">Nearly there</p>
        <h3 className="display-md mt-4 max-w-[18ch] text-white">
          Your enquiry is written out and ready to send
        </h3>
        <p className="copy mt-5 max-w-[52ch] text-white/70">
          It has opened in WhatsApp (or your email app) with every detail filled in.
          Press send there and it reaches us — nothing is sent from this page on its
          own.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button type="button" onClick={() => handOff("whatsapp")} className="btn-ghost btn-on-dark">
            Open WhatsApp again
          </button>
          <button
            type="button"
            onClick={() => handOff("email")}
            className="label-xs link-quiet text-white/70 hover:text-white"
          >
            Send by email instead
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="label-xs link-quiet text-white/70 hover:text-white"
          >
            {copied ? "Copied" : "Copy the details"}
          </button>
        </div>

        <p className="label-xs mt-8 max-w-[60ch] text-white/55">
          Prefer to talk? Call{" "}
          <a href={contact.phoneHref} className="link-quiet text-white">
            {contact.phoneDisplay}
          </a>
          .{" "}
          <button
            type="button"
            onClick={() => setStatus("editing")}
            className="link-quiet text-white"
          >
            Edit the details
          </button>
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="w-full">
      <p className="label-xs mb-8 normal-case tracking-normal text-white/55">
        Fields not marked optional are needed to quote.
      </p>

      <div
        role="alert"
        className={errorCount ? "mb-8 border-l border-white py-1 pl-4" : "sr-only"}
      >
        {errorCount ? (
          <p className="copy text-white">
            {errorCount === 1
              ? "One detail needs a look before this can be sent."
              : `${errorCount} details need a look before this can be sent.`}
          </p>
        ) : null}
      </div>

      {body}

      <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">
        <button
          type="submit"
          disabled={status === "opening"}
          aria-busy={status === "opening"}
          className="btn-ghost btn-on-dark disabled:cursor-wait disabled:opacity-60"
        >
          {status === "opening" ? "Opening WhatsApp…" : "Continue in WhatsApp"}
        </button>
        <button
          type="button"
          onClick={onEmail}
          className="label-xs link-quiet text-white/70 hover:text-white"
        >
          Or send it by email
        </button>
      </div>

      <p className="label-xs mt-6 max-w-[60ch] normal-case tracking-normal text-white/55">
        This writes your enquiry out as a message for you to send — nothing is stored
        or submitted from this page. Handled in confidence.
      </p>
    </form>
  );
}
