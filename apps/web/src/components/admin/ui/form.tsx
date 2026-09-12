"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

/**
 * Form building blocks.
 *
 * `Field` owns the label, the required marker, the help text and the error,
 * and hands its control the ids that tie them together — so every input is
 * labelled, described and flagged correctly without each form wiring it.
 */

export type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
};

export function Field({
  label,
  required,
  description,
  error,
  counter,
  className,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  description?: ReactNode;
  error?: string;
  /** Shows "used / max" under the control — used for SEO lengths. */
  counter?: { value: string; max: number };
  className?: string;
  /** A small control beside the label, e.g. "Generate from name". */
  action?: ReactNode;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, description ? `${id}-description` : null]
    .filter(Boolean)
    .join(" ");

  const over = counter ? counter.value.length > counter.max : false;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="label-xs text-white/70">
          {label}
          {required ? (
            <span className="ml-1.5 text-silver" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only"> (required)</span> : null}
        </label>
        {action}
      </div>
      <div className="mt-2">
        {children({
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy || undefined,
          "aria-required": required ? true : undefined,
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex gap-2 text-[0.8125rem] leading-snug text-alert">
          <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-current" />
          {error}
        </p>
      ) : null}
      {description || counter ? (
        <div className="mt-2 flex items-start justify-between gap-4">
          {description ? (
            <p id={`${id}-description`} className="text-[0.8125rem] leading-snug text-white/55">
              {description}
            </p>
          ) : (
            <span />
          )}
          {counter ? (
            <span
              className={cn("shrink-0 text-[0.75rem] tabular-nums", over ? "text-alert" : "text-white/55")}
              aria-live="polite"
            >
              {counter.value.length} / {counter.max}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const controlClass =
  "w-full rounded-[2px] border border-white/15 bg-obsidian px-3 font-ui text-[0.875rem] text-white placeholder:text-white/40 transition-colors duration-200 hover:border-white/30 focus:border-white focus:outline-none focus:ring-1 focus:ring-white aria-[invalid=true]:border-alert aria-[invalid=true]:ring-alert disabled:cursor-not-allowed disabled:opacity-50";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, "h-10", className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(controlClass, "resize-y py-2.5 leading-relaxed", className)} {...props} />;
}

/**
 * Number input that stores `null` for "not set" rather than 0 — so an
 * unconfirmed capacity or rate never turns into a false figure.
 */
export function NumberInput({
  value,
  onValueChange,
  className,
  prefix,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[0.875rem] text-white/50">
          {prefix}
        </span>
      ) : null}
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.target.value;
          onValueChange(raw === "" ? null : Number(raw));
        }}
        className={cn(controlClass, "h-10 tabular-nums", prefix ? "pl-7" : "", className)}
        {...props}
      />
    </div>
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-9 [&>option]:bg-ink", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/50"
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-flex size-4.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={description ? `${id}-d` : undefined}
          className="peer size-4.5 cursor-pointer appearance-none rounded-[2px] border border-white/35 bg-obsidian transition-colors checked:border-white checked:bg-white hover:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45"
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3 text-ink opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[0.875rem] leading-snug text-white/90">
          {label}
        </label>
        {description ? (
          <span id={`${id}-d`} className="mt-0.5 block text-[0.8125rem] leading-snug text-white/55">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  describedBy,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — required even when a visible label sits beside it. */
  label: string;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-[2px] border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45",
        checked ? "border-white bg-white" : "border-white/35 bg-obsidian",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block size-3 rounded-[1px] transition-transform duration-200 motion-reduce:transition-none",
          checked ? "translate-x-4.75 bg-ink" : "translate-x-0.75 bg-white/60",
        )}
      />
    </button>
  );
}

/** A fieldset of checkbox "chips" — services, features, groupings. */
export function CheckboxGrid<T extends string>({
  legend,
  description,
  options,
  value,
  onChange,
  error,
  required,
  columns = 2,
}: {
  legend: string;
  description?: ReactNode;
  options: readonly { value: T; label: string; note?: string }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  error?: string;
  required?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const id = useId();
  const toggle = (option: T, on: boolean) =>
    onChange(on ? [...value, option] : value.filter((item) => item !== option));

  return (
    <fieldset aria-describedby={error ? `${id}-error` : description ? `${id}-description` : undefined}>
      <legend className="label-xs text-white/70">
        {legend}
        {required ? (
          <>
            <span className="ml-1.5 text-silver" aria-hidden>
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </legend>
      {description ? (
        <p id={`${id}-description`} className="mt-2 text-[0.8125rem] leading-snug text-white/55">
          {description}
        </p>
      ) : null}
      {/* The container is the wrapper: an element cannot query its own width. */}
      <div className="@container mt-3">
        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            columns === 2 && "@md:grid-cols-2",
            columns === 3 && "@md:grid-cols-2 @4xl:grid-cols-3",
          )}
        >
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  "border px-3 py-2.5 transition-colors duration-200",
                  checked ? "border-white/60 bg-white/4" : "border-white/12 hover:border-white/30",
                )}
              >
                <Checkbox
                  label={option.label}
                  description={option.note}
                  checked={checked}
                  onChange={(on) => toggle(option.value, on)}
                />
              </div>
            );
          })}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex gap-2 text-[0.8125rem] leading-snug text-alert">
          <span aria-hidden className="mt-[0.6em] h-px w-3 shrink-0 bg-current" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Exclusive choice as hairline cards — status, template, customer type. */
export function ChoiceCards<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
  columns = 3,
}: {
  legend: string;
  options: readonly { value: T; label: string; note?: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: 2 | 3;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled}>
      <legend className="label-xs text-white/70">{legend}</legend>
      <div className="@container mt-3">
        <div className={cn("grid grid-cols-1 gap-2", columns === 3 ? "@lg:grid-cols-3" : "@md:grid-cols-2")}>
          {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative block cursor-pointer border px-3 py-2.5 transition-colors duration-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white has-disabled:cursor-not-allowed has-disabled:opacity-45",
              value === option.value ? "border-white bg-white/5" : "border-white/12 hover:border-white/30",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-3 text-[0.875rem] text-white">
              {option.label}
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 border",
                  value === option.value ? "border-white bg-white" : "border-white/40",
                )}
              />
            </span>
              {option.note ? <span className="mt-1 block text-[0.75rem] leading-snug text-white/55">{option.note}</span> : null}
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

/**
 * A titled group of fields inside an editor. The numbered label and display
 * title are the site's section grammar, at working size.
 */
export function FormSection({
  id,
  index,
  title,
  description,
  children,
  aside,
}: {
  id: string;
  index?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Right-aligned control in the header, e.g. a status toggle. */
  aside?: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-hairline pt-6 pb-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {index ? <p className="label-xs text-silver">{index}</p> : null}
          <h2 id={`${id}-title`} className="display-sm mt-2 text-white">
            {title}
          </h2>
          {description ? <p className="mt-2 max-w-[62ch] text-[0.8125rem] leading-relaxed text-white/55">{description}</p> : null}
        </div>
        {aside}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

/**
 * Fields side by side once there is room for them. Measured against the
 * column the row sits in, not the window — the same row is used in a wide
 * editor and in a narrow side-by-side panel.
 */
export function FieldRow({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <div className="@container">
      <div className={cn("grid grid-cols-1 gap-6", columns === 2 ? "@md:grid-cols-2" : "@md:grid-cols-3")}>
        {children}
      </div>
    </div>
  );
}

/** Summary of errors at the top of a form after a failed save. */
export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels?: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div role="alert" className="border-l-2 border-alert bg-alert/6 px-4 py-3">
      <p className="text-[0.875rem] font-medium text-white">
        {entries.length === 1 ? "One field needs attention before saving." : `${entries.length} fields need attention before saving.`}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {entries.slice(0, 6).map(([key, message]) => (
          <li key={key} className="text-[0.8125rem] leading-snug text-white/70">
            {labels?.[key] ? <span className="text-white">{labels[key]}: </span> : null}
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
