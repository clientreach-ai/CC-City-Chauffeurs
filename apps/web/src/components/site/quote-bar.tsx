"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { DateField } from "@/components/ui/date-field";
import { routes } from "@/content/site";

/**
 * The three questions that start every quote.
 *
 * The client currently chases date, time and passenger numbers on every single
 * enquiry, so those are what we ask first — the answers travel to the quote
 * page as query parameters and pre-fill the full form, rather than being
 * asked twice.
 *
 * Deliberately not a booking widget: there is no availability engine behind
 * this yet, and a control that implies instant confirmation would be a
 * promise the business cannot keep.
 */
const services = [
  "Wedding",
  "Airport transfer",
  "Corporate travel",
  "Private chauffeur",
  "Event or occasion",
  "Supercar",
] as const;

const fieldClass =
  "w-full appearance-none rounded-none border-0 bg-transparent px-0 py-2 font-[family-name:var(--font-ui)] text-[0.9375rem] text-white placeholder:text-white/50 focus:outline-none [color-scheme:dark]";

function Cell({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-5 py-3.5 sm:px-6 sm:py-4 ${className}`}>
      <label htmlFor={htmlFor} className="label-xs block text-white/55">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function QuoteBar() {
  const router = useRouter();
  const [service, setService] = useState<string>(services[0]);
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams({ service });
    if (date) params.set("date", date);
    if (passengers) params.set("passengers", passengers);
    router.push(`${routes.quote}?${params.toString()}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glow-edge glow-ring grid grid-cols-1 items-stretch bg-white/[0.04] backdrop-blur-[2px] sm:grid-cols-[1.2fr_1fr_0.8fr_auto] sm:divide-x sm:divide-hairline"
      aria-label="Start a quote"
    >
      <Cell
        label="Service"
        htmlFor="qb-service"
        className="border-b border-hairline sm:border-b-0"
      >
        <select
          id="qb-service"
          value={service}
          onChange={(event) => setService(event.target.value)}
          className={fieldClass}
        >
          {services.map((option) => (
            <option key={option} value={option} className="bg-ink text-white">
              {option}
            </option>
          ))}
        </select>
      </Cell>

      <Cell
        label="Date"
        htmlFor="qb-date"
        className="border-b border-hairline sm:border-b-0"
      >
        <DateField id="qb-date" label="Date" value={date} onChange={setDate} />
      </Cell>

      <Cell
        label="Passengers"
        htmlFor="qb-passengers"
        className="border-b border-hairline sm:border-b-0"
      >
        <input
          id="qb-passengers"
          type="number"
          inputMode="numeric"
          min={1}
          max={16}
          placeholder="—"
          value={passengers}
          onChange={(event) => setPassengers(event.target.value)}
          className={fieldClass}
        />
      </Cell>

      <div className="p-3 sm:flex sm:items-center sm:p-3">
        <button
          type="submit"
          className="btn-ghost btn-solid-invert w-full sm:h-full sm:w-auto sm:px-8"
        >
          Get a price
        </button>
      </div>
    </form>
  );
}
