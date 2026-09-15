import { CmsNotFoundError, CmsValidationError } from "@CC-City-Chauffeurs/core";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

/**
 * One place that decides what a thrown thing becomes on the wire.
 *
 * The admin's screens already know how to show a `CmsValidationError` — field
 * by field, beside the input that caused it. Keeping that shape across the
 * network is what lets the same form code work against a real API.
 */

export class ForbiddenError extends Error {
  constructor(message = "Your role does not include this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorisedError extends Error {
  constructor(message = "Sign in to continue.") {
    super(message);
    this.name = "UnauthorisedError";
  }
}

/** A rule that is not about one field, e.g. "move its vehicles first". */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function errorResponse(error: unknown, c: Context) {
  if (error instanceof CmsValidationError) {
    return c.json({ error: error.message, fields: error.fields }, 422);
  }
  if (error instanceof ZodError) {
    // A malformed body is a programming error, not an editor's mistake, but
    // report it in the same shape so nothing has to special-case it.
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "body";
      fields[path] ??= issue.message;
    }
    return c.json({ error: "That request was not in the expected shape.", fields }, 422);
  }
  if (error instanceof CmsNotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof UnauthorisedError) {
    return c.json({ error: error.message }, 401);
  }
  if (error instanceof ForbiddenError) {
    return c.json({ error: error.message }, 403);
  }
  if (error instanceof ConflictError) {
    return c.json({ error: error.message }, 409);
  }
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  console.error(error);
  return c.json({ error: "Something went wrong. Nothing was changed." }, 500);
}
