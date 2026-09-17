"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { PUBLIC_FORM_LIMITS } from "@CC-City-Chauffeurs/core/validation";
import { NO_VEHICLE_PREFERENCE, replyOptions } from "@/content/enquiry";
import { recordEnquiry } from "@/lib/enquiries";

/** The contact details the site is configured with, from the admin. */
export type ContactDetails = {
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  whatsappNumber: string;
  whatsappIntro: string;
};

/** The service list the form offers, from the admin. */
export type ServiceOptionItem = { value: string; label: string };

/** A vehicle the preference list offers. The id is what is recorded; the
 *  name is what the visitor reads. */
export type VehicleOption = { id: string; name: string };

/*
 * The enquiry form.
 *
 * It records the request against the business's own inbox and shows the
 * visitor the reference it was given. Only then does it offer WhatsApp or
 * email, as a continuation they choose — handing the message to a chat window
 * before the record exists is how an enquiry gets missed, and for years this
 * form did exactly that while telling everyone it had worked.
 *
 * So the submission is awaited and every outcome is shown. A failure is
 * retryable with the form still filled in; a rule the API applied lands
 * beside the input that broke it. `PUBLIC_FORM_LIMITS` is shared with the
 * API's own schema, so a field this form lets someone fill is never one the
 * API then refuses.
 *
 * Two variants, one set of fields, and one thing made either way — an enquiry
 * the office answers, and turns into a booking once the journey is agreed:
 *
 *   "short"  the homepage and contact bands — who you are and roughly what
 *   "full"   the request page: the whole journey in one pass (PRD §10.1)
 *
 * The date is optional in both. Somebody who has not settled on one is
 * precisely who the request page is also for, and "sometime in June" is an
 * answerable enquiry; agreeing a date is what the office does next.
 */

type Variant = "short" | "full";

type FormState = {
  service: string;
  date: string;
  time: string;
  pickup: string;
  destination: string;
  flight: string;
  passengers: string;
  luggage: string;
  /** The chosen vehicle's id, or "" for no preference. */
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
  full: ["service", "pickup", "passengers", "name", "phone"],
};

/**
 * Which shared limit guards each field the visitor types into. The form's own
 * names differ from the contract's in two places, which is the whole reason
 * this mapping is written out rather than inferred.
 */
const LIMIT: Partial<Record<FieldKey, number>> = {
  name: PUBLIC_FORM_LIMITS.name,
  phone: PUBLIC_FORM_LIMITS.phone,
  email: PUBLIC_FORM_LIMITS.email,
  pickup: PUBLIC_FORM_LIMITS.pickup,
  destination: PUBLIC_FORM_LIMITS.dropoff,
  time: PUBLIC_FORM_LIMITS.time,
  luggage: PUBLIC_FORM_LIMITS.luggage,
  flight: PUBLIC_FORM_LIMITS.flight,
  notes: PUBLIC_FORM_LIMITS.message,
};

/** The contract's field names, mapped back onto this form's own. */
const FIELD_OF: Record<string, FieldKey> = {
  name: "name",
  phone: "phone",
  email: "email",
  service: "service",
  vehicleId: "vehicle",
  pickup: "pickup",
  dropoff: "destination",
  date: "date",
  time: "time",
  passengers: "passengers",
  luggage: "luggage",
  flight: "flight",
  message: "notes",
};

/** Where the submission has got to. */
type Submission =
  | { state: "editing" }
  | { state: "sending" }
  | { state: "sent"; reference: string }
  | { state: "failed"; message: string };

const fieldClass =
  "w-full appearance-none rounded-none border-x-0 border-t-0 border-b border-hairline bg-transparent px-0 py-3 font-ui text-[0.9375rem] text-white placeholder:text-white/45 transition-colors duration-500 focus:border-white focus:outline-none aria-invalid:border-white";

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * One id per request, compared only against itself.
 *
 * `crypto.randomUUID` needs a secure context, which a site served over http
 * on a local network is not — and a form that throws there rather than
 * falling back would be a form nobody could send.
 */
function newSubmissionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function serviceLabel(value: string, services: ServiceOptionItem[]) {
  return services.find((option) => option.value === value)?.label ?? value;
}

/** Accepts a slug ("airport-transfers") or a label ("Airport transfer"). */
function matchService(raw: string | null, services: ServiceOptionItem[]): string | undefined {
  if (!raw) return undefined;
  const needle = raw.trim().toLowerCase();
  return services.find(
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

  if (missing("name")) errors.name = "Tell us who we are replying to.";

  if (missing("phone")) {
    errors.phone = "Add a number so we can reply — WhatsApp is fine.";
  } else if (form.phone.trim() && form.phone.replace(/[^\d]/g, "").length < 7) {
    errors.phone = "That number looks too short — check it and include the area code.";
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    errors.email = "That email address does not look complete.";
  }

  // The date is nobody's required field: it may not be settled yet. A date
  // that has been settled and has already gone is still worth catching.
  if (form.date && form.date < todayISO()) {
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

  /*
   * `maxLength` already stops the typing and truncates a paste, so this only
   * catches what arrives some other way — a prefilled query string, an
   * autofill, a control with no maxLength to give. It is here so the API
   * never has to refuse a message this form let somebody write.
   */
  for (const key of Object.keys(LIMIT) as FieldKey[]) {
    const limit = LIMIT[key];
    if (limit && !errors[key] && String(form[key]).trim().length > limit) {
      errors[key] = `That is longer than this field takes — please shorten it to ${limit} characters.`;
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
  contact,
  services,
}: {
  variant?: Variant;
  /** Service to preselect, as a slug or a label. */
  defaultService?: string;
  /** The vehicles the preference list offers — id and name only, so the
   *  fleet model never reaches the client bundle. */
  vehicles?: readonly VehicleOption[];
  /** Where enquiries go, as configured in the admin. */
  contact: ContactDetails;
  /** What the service dropdown offers, as configured in the admin. */
  services: ServiceOptionItem[];
}) {
  /** The request page's three-group layout; the short bands are one grid. */
  const full = variant === "full";
  const uid = useId();
  const id = (key: string) => `${uid}-${key}`;
  const formRef = useRef<HTMLFormElement>(null);

  const blank = (): FormState => ({
    service: matchService(defaultService ?? null, services) ?? services[0]?.value ?? "",
    date: "",
    time: "",
    pickup: "",
    destination: "",
    flight: "",
    passengers: "",
    luggage: "",
    vehicle: "",
    notes: "",
    name: "",
    phone: "",
    email: "",
    reply: "WhatsApp",
  });

  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [submission, setSubmission] = useState<Submission>({ state: "editing" });
  const [copied, setCopied] = useState(false);
  /** The honeypot's value. Kept out of `FormState`, which is what a person fills in. */
  const [honeypot, setHoneypot] = useState("");

  /*
   * The id this submission carries, minted when the visitor starts filling
   * the form in rather than when they press send. Every retry sends the same
   * value, so a send that failed on the way back and a second, impatient
   * press both resolve to the one record — the API returns the reference it
   * gave the first time instead of opening another. Only "Send another"
   * mints a fresh one, because only that is a genuinely new request.
   */
  const submissionId = useRef("");
  const startSubmission = () => {
    if (!submissionId.current) submissionId.current = newSubmissionId();
    return submissionId.current;
  };

  /*
   * Links from service and fleet pages carry the answers they already know
   * (?service=, ?vehicle=, ?date=, ?passengers=). Read once after mount, so
   * the form itself is server-rendered and the page stays static.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = matchService(params.get("service"), services);
    const vehicleParam = params.get("vehicle")?.toLowerCase();
    const vehicle = vehicles.find((item) => item.name.toLowerCase() === vehicleParam)?.id;
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
    startSubmission();
    const next = { ...form, [key]: value };
    setForm(next);
    // Once someone has tried to send, keep the messages honest as they fix things.
    if (attempted) setErrors(validate(next, variant));
    // A failure they are now editing their way out of should stop shouting.
    if (submission.state === "failed") setSubmission({ state: "editing" });
  };

  const isAirport = form.service === "airport-transfers";
  const vehicleName = (vehicleId: string) =>
    vehicles.find((item) => item.id === vehicleId)?.name ?? "";

  const composeMessage = (reference?: string) => {
    const journey = [
      `Service: ${serviceLabel(form.service, services)}`,
      form.date && `Date: ${form.date}${form.time ? ` at ${form.time}` : ""}`,
      form.pickup && `Pick-up: ${form.pickup}`,
      form.destination && `Destination: ${form.destination}`,
      isAirport && form.flight && `Flight: ${form.flight}`,
      form.passengers && `Passengers: ${form.passengers}`,
      form.luggage && `Luggage: ${form.luggage}`,
      full && form.vehicle && `Vehicle: ${vehicleName(form.vehicle)}`,
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
      "Chauffeur enquiry — City Chauffeurs",
      // The reference is what lets the office match this message to the record
      // it already has, rather than treating it as a second request.
      reference && `Reference: ${reference}`,
      lines(journey),
      lines(person),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const mailtoHref = (reference?: string) => {
    const subject = full
      ? `Chauffeur enquiry — ${serviceLabel(form.service, services)}`
      : "Chauffeur enquiry";
    // The reference, where there is one, is what lets the office match this
    // message to the record it already has rather than open a second.
    return `mailto:${contact.email}?subject=${encodeURIComponent(
      reference ? `${subject} (${reference})` : subject,
    )}&body=${encodeURIComponent(composeMessage(reference))}`;
  };

  /** After the errors render, focus the first flagged field in on-screen
   *  order — not validation order, which differs between the variants. */
  const focusFirstProblem = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  /** Validates, and on failure moves focus to the first problem. */
  const check = () => {
    setAttempted(true);
    const found = validate(form, variant);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstProblem();
      return false;
    }
    return true;
  };

  /** What the API stores. The message itself is what the customer wrote. */
  const payload = () => ({
    name: form.name,
    phone: form.phone,
    email: form.email,
    service: form.service,
    vehicleId: form.vehicle || null,
    pickup: form.pickup,
    dropoff: form.destination,
    date: form.date,
    time: form.time,
    passengers: form.passengers ? Number(form.passengers) : null,
    luggage: form.luggage,
    flight: form.flight,
    message: form.notes,
    submissionId: startSubmission(),
    website: honeypot,
  });

  /**
   * Records the request and waits for the answer.
   *
   * Nothing is opened from here. A window opened after an await is one a
   * pop-up blocker is entitled to swallow, and — more to the point — the
   * visitor should not be sent to WhatsApp before we know whether we have
   * their details. The continuation is a button they press.
   */
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submission.state === "sending" || !check()) return;
    setSubmission({ state: "sending" });

    const journey = payload();
    // The visitor picks a channel by its label; the contract names it in its
    // own terms, and "Phone call" is the one that is not simply lowercased.
    const replyBy =
      form.reply === "Phone call" ? "phone" : form.reply === "Email" ? "email" : "whatsapp";
    const result = await recordEnquiry({ ...journey, replyBy });

    if (result.ok) {
      setSubmission({ state: "sent", reference: result.reference });
      return;
    }

    if (result.reason === "invalid") {
      // A rule the API applied and this form did not. Each message goes beside
      // the input that caused it; anything it named that this form has no
      // input for leaves the banner to say so on its own.
      const found: Errors = {};
      for (const [field, message] of Object.entries(result.fields)) {
        const key = FIELD_OF[field];
        if (key) found[key] = message;
      }
      setAttempted(true);
      setErrors(found);
      if (Object.keys(found).length) focusFirstProblem();
    }

    setSubmission({ state: "failed", message: result.message });
  };

  const openWhatsApp = (reference: string) => {
    const text = encodeURIComponent(composeMessage(reference));
    window.open(
      `https://wa.me/${contact.whatsappNumber}?text=${text}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const onCopy = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(composeMessage(reference));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  /** A genuinely new request: a clean form and a fresh submission id. */
  const startAnother = () => {
    submissionId.current = "";
    setForm(blank());
    setErrors({});
    setAttempted(false);
    setCopied(false);
    setHoneypot("");
    setSubmission({ state: "editing" });
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
    <Field id={id("service")} label="Service" error={errors.service}>
      <select
        {...aria("service")}
        required={req("service")}
        value={form.service}
        onChange={(e) => set("service")(e.target.value)}
        className={`${fieldClass} cursor-pointer`}
      >
        {services.map((option) => (
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
        maxLength={PUBLIC_FORM_LIMITS.pickup}
        value={form.pickup}
        onChange={(e) => set("pickup")(e.target.value)}
        placeholder="Address, hotel or airport"
        className={fieldClass}
      />
    </Field>
  );

  const destinationField = (
    <Field
      id={id("destination")}
      label="Destination"
      optional
      error={errors.destination}
      className={full ? "sm:col-span-2" : ""}
    >
      <input
        {...aria("destination")}
        maxLength={PUBLIC_FORM_LIMITS.dropoff}
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
        maxLength={PUBLIC_FORM_LIMITS.name}
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
        maxLength={PUBLIC_FORM_LIMITS.phone}
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
      error={errors.notes}
      className="sm:col-span-2"
    >
      <textarea
        {...aria("notes", full)}
        rows={full ? 3 : 2}
        maxLength={PUBLIC_FORM_LIMITS.message}
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
          <Field id={id("time")} label="Pick-up time" optional error={errors.time}>
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
              error={errors.flight}
            >
              <input
                {...aria("flight", true)}
                autoCapitalize="characters"
                maxLength={PUBLIC_FORM_LIMITS.flight}
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
          <Field id={id("luggage")} label="Luggage" optional error={errors.luggage}>
            <input
              {...aria("luggage")}
              maxLength={PUBLIC_FORM_LIMITS.luggage}
              value={form.luggage}
              onChange={(e) => set("luggage")(e.target.value)}
              placeholder="Large cases, or none"
              className={fieldClass}
            />
          </Field>
          {vehicles.length ? (
            <Field
              id={id("vehicle")}
              label="Vehicle preference"
              optional
              error={errors.vehicle}
              className="sm:col-span-2"
            >
              <select
                {...aria("vehicle")}
                value={form.vehicle}
                onChange={(e) => set("vehicle")(e.target.value)}
                className={`${fieldClass} cursor-pointer`}
              >
                {/* The id is what is recorded, so "no preference" is the
                    absence of one — an empty value, not a sentence. */}
                <option value="" className="bg-ink text-white">
                  {NO_VEHICLE_PREFERENCE}
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id} className="bg-ink text-white">
                    {vehicle.name}
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
            hint="If you would rather the office came back to you in writing."
            error={errors.email}
            className="sm:col-span-2"
          >
            <input
              {...aria("email", true)}
              type="email"
              autoComplete="email"
              maxLength={PUBLIC_FORM_LIMITS.email}
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

  // ----------------------------------------------------------------- states

  if (submission.state === "sent") {
    const { reference } = submission;
    return (
      <div className="border-t border-hairline pt-8" role="status" aria-live="polite">
        <p className="label-xs text-silver">Received</p>
        <h3 className="display-md mt-4 max-w-[22ch] text-white">
          {reference
            ? `Enquiry received. Your reference is ${reference}.`
            : "Enquiry received."}
        </h3>
        <p className="copy mt-5 max-w-[54ch] text-white/70">
          It is with the office now and a person will answer it with what is available.
          Nothing is held and nothing is charged until you have agreed it. Quote the
          reference if you call in the meantime.
        </p>
        <p className="copy mt-4 max-w-[54ch] text-white/70">
          We have it either way. If you would like it in front of us sooner, send the
          same details on WhatsApp as well.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          {/*
            Opened straight from this click. A window opened after an await is
            one a pop-up blocker is entitled to swallow, which is why the
            record is already made by the time this button exists.
          */}
          <button
            type="button"
            onClick={() => openWhatsApp(reference)}
            className="btn-ghost btn-on-dark"
          >
            Send it on WhatsApp
          </button>
          <a
            href={mailtoHref(reference)}
            className="label-xs link-quiet text-white/70 hover:text-white"
          >
            Send it by email instead
          </a>
          <button
            type="button"
            onClick={() => onCopy(reference)}
            className="label-xs link-quiet text-white/70 hover:text-white"
          >
            {copied ? "Copied" : "Copy the details"}
          </button>
        </div>

        <p className="label-xs mt-8 max-w-[60ch] text-white/55">
          Prefer to talk? Call{" "}
          <a href={`tel:${contact.phoneE164}`} className="link-quiet text-white">
            {contact.phoneDisplay}
          </a>
          .{" "}
          <button type="button" onClick={startAnother} className="link-quiet text-white">
            Send another enquiry
          </button>
        </p>
      </div>
    );
  }

  const sending = submission.state === "sending";
  const notice =
    submission.state === "failed"
      ? submission.message
      : errorCount === 1
        ? "One detail needs a look before this can be sent."
        : errorCount > 1
          ? `${errorCount} details need a look before this can be sent.`
          : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="relative w-full">
      <p className="label-xs mb-8 normal-case tracking-normal text-white/55">
        Fields not marked optional are the ones we need before we can reply.
      </p>

      <div role="alert" className={notice ? "mb-8 border-l border-white py-1 pl-4" : "sr-only"}>
        {notice ? <p className="copy text-white">{notice}</p> : null}
      </div>

      {body}

      {/*
        The honeypot. No person sees this field, nothing focuses it and no
        password manager fills it, so anything arriving with it set was set by
        a machine — the API answers those exactly as it answers a person,
        minus the record.
      */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-5">
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="btn-ghost btn-on-dark disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send the enquiry"}
        </button>
        {submission.state === "failed" ? (
          <a
            href={`tel:${contact.phoneE164}`}
            className="label-xs link-quiet text-white/70 hover:text-white"
          >
            Or call {contact.phoneDisplay}
          </a>
        ) : null}
      </div>

      <p className="label-xs mt-6 max-w-[60ch] normal-case tracking-normal text-white/55">
        This records your enquiry with the office so it is not left sitting in a chat
        window, and gives you a reference. You can send the same details on WhatsApp
        afterwards if you would like. Nothing is held and nothing is charged here.
        Handled in confidence.
      </p>
    </form>
  );
}
