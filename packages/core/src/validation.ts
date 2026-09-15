/**
 * Validation shared by the editors and the repositories.
 *
 * The forms validate as you type; the repositories validate again on write,
 * exactly as an API would. A failed write throws `CmsValidationError` with
 * per-field messages, and the form shows them inline — so moving validation
 * to the server later changes nothing on screen.
 */

export type FieldErrors = Record<string, string>;

export class CmsValidationError extends Error {
  constructor(
    public readonly fields: FieldErrors,
    message = "Some fields need attention.",
  ) {
    super(message);
    this.name = "CmsValidationError";
  }
}

export class CmsNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} could not be found. It may have been deleted.`);
    this.name = "CmsNotFoundError";
  }
}

/** Collects field errors; `result()` is empty when everything passed. */
export function validator() {
  const errors: FieldErrors = {};
  const api = {
    required(field: string, value: unknown, message = "This field is required.") {
      const empty =
        value == null ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (empty && !errors[field]) errors[field] = message;
      return api;
    },
    maxLength(field: string, value: string, max: number) {
      if (value && value.length > max && !errors[field]) {
        errors[field] = `Keep this under ${max} characters (currently ${value.length}).`;
      }
      return api;
    },
    slug(field: string, value: string) {
      if (value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && !errors[field]) {
        errors[field] = "Use lowercase letters, numbers and single hyphens only.";
      }
      return api;
    },
    email(field: string, value: string) {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && !errors[field]) {
        errors[field] = "That email address does not look complete.";
      }
      return api;
    },
    phone(field: string, value: string) {
      if (value && value.replace(/[^\d]/g, "").length < 7 && !errors[field]) {
        errors[field] = "That number looks too short — include the area code.";
      }
      return api;
    },
    url(field: string, value: string) {
      if (value && !/^https:\/\/[^\s]+\.[^\s]+$/.test(value.trim()) && !errors[field]) {
        errors[field] = "Enter a full address starting with https://";
      }
      return api;
    },
    /** Internal paths ("/fleet"), in-page anchors ("#enquire") or https links. */
    link(field: string, value: string) {
      if (value && !/^(\/|#|https:\/\/|tel:|mailto:)/.test(value.trim()) && !errors[field]) {
        errors[field] = "Start with / for a page on this site, # for a section, or https://";
      }
      return api;
    },
    integer(field: string, value: number | null, min: number, max: number) {
      if (value != null && (!Number.isInteger(value) || value < min || value > max) && !errors[field]) {
        errors[field] = `Enter a whole number between ${min} and ${max}.`;
      }
      return api;
    },
    amount(field: string, value: number | null) {
      if (value != null && (!Number.isFinite(value) || value < 0 || value > 100_000) && !errors[field]) {
        errors[field] = "Enter an amount in pounds, without the £ sign.";
      }
      return api;
    },
    custom(field: string, failed: boolean, message: string) {
      if (failed && !errors[field]) errors[field] = message;
      return api;
    },
    result() {
      return errors;
    },
  };
  return api;
}

export function hasErrors(errors: FieldErrors) {
  return Object.keys(errors).length > 0;
}

/** Throws when the collected errors are not empty — used by repositories. */
export function assertValid(errors: FieldErrors) {
  if (hasErrors(errors)) throw new CmsValidationError(errors);
}

/** Search-result lengths: Google truncates past roughly these. */
export const SEO_LIMITS = { title: 60, description: 160 } as const;
