import type { Vehicle } from "./types";

/**
 * Display formatting for the admin. British conventions throughout: day
 * before month, 24-hour clock, pounds sterling.
 */

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

/** "12 Sept 2026" */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = parseDate(value);
  return date ? dateFormat.format(date) : "—";
}

/** "Fri 12 Sept" */
export function formatShortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = parseDate(value);
  return date ? shortDateFormat.format(date) : "—";
}

/** "14:30" */
export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timeFormat.format(date);
}

/** "12 Sept 2026, 14:30" */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${dateFormat.format(date)}, ${timeFormat.format(date)}`;
}

/** "Today · 10:32", "Yesterday · 18:05", "3 Sept · 09:14" */
export function formatWhen(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = dayDifference(date, now);
  const time = timeFormat.format(date);
  if (days === 0) return `Today · ${time}`;
  if (days === -1) return `Yesterday · ${time}`;
  return `${shortDateFormat.format(date)} · ${time}`;
}

/** "Waiting 3 h", "Waiting 2 days" — for unanswered enquiries. */
export function formatAge(value: string, now = new Date()) {
  const ms = now.getTime() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** "Updated 2 h ago" style relative stamp for content records. */
export function formatRelative(value: string | null | undefined, now = new Date()) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return dateFormat.format(date);
}

export function formatMoney(value: number | null | undefined) {
  return value == null ? "" : money.format(value);
}

/** The public rate line — "From £200 / hour" or "On request". */
export function rateLabel(vehicle: Pick<Vehicle, "pricing">) {
  return vehicle.pricing.hourlyRate != null
    ? `From ${money.format(vehicle.pricing.hourlyRate)} / hour`
    : "On request";
}

/** What the public site prints where the client has not confirmed capacity. */
export const UNCONFIRMED = "On enquiry";

export function passengersText(vehicle: Pick<Vehicle, "specs">) {
  return vehicle.specs.passengers != null ? String(vehicle.specs.passengers) : UNCONFIRMED;
}

/** A whole phrase: "3 passengers", or "Capacity on enquiry" when unconfirmed. */
export function passengersLine(vehicle: Pick<Vehicle, "specs">) {
  return vehicle.specs.passengers != null
    ? `${vehicle.specs.passengers} passengers`
    : `Capacity ${UNCONFIRMED.toLowerCase()}`;
}

export function formatBytes(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Today in local time, as "YYYY-MM-DD". */
export function todayISO(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Calendar dates ("2026-09-12") parse as local midnight, not UTC. */
function parseDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayDifference(date: Date, now: Date) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
