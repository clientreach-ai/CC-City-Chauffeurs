import { CmsNotFoundError, CmsValidationError } from "@CC-City-Chauffeurs/core";
import { env } from "@CC-City-Chauffeurs/env/admin";

import { invalidateAdmin } from "../query/client";

/**
 * The one place the admin talks to the API.
 *
 * It restores the errors the screens already know how to show: a 422 becomes
 * the `CmsValidationError` the forms read field by field, a 404 becomes
 * `CmsNotFoundError`. That is what lets a form written against the old local
 * adapter work unchanged against a real server.
 */

/**
 * Relative, so these go to the admin's own origin and `next.config.ts`
 * forwards them to the API. That keeps the session cookie first-party — see
 * the note there. Every caller is a client component, so there is no render
 * pass that would have to resolve this against a host.
 */
const BASE = "/api/admin";

/** The session has gone. The shell catches this and sends you to sign in. */
export class UnauthorisedError extends Error {
  constructor(message = "Your session has ended. Sign in again to continue.") {
    super(message);
    this.name = "UnauthorisedError";
  }
}

type ErrorBody = { error?: string; fields?: Record<string, string> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      // The session cookie rides on this origin now, but keep it explicit:
      // better-auth's own client sends credentials too.
      credentials: "include",
      headers: {
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  // Anything that changed something means every list may now be out of date.
  if (response.ok && init?.method && init.method !== "GET") invalidateAdmin();

  if (response.status === 204) return undefined as T;

  const body: unknown = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;

  if (response.ok) return body as T;

  const { error, fields } = (body ?? {}) as ErrorBody;

  if (response.status === 401) throw new UnauthorisedError(error);
  if (response.status === 422 && fields) throw new CmsValidationError(fields, error);
  if (response.status === 404) {
    // The server already words these ("This vehicle could not be found…").
    const notFound = new CmsNotFoundError("This record");
    if (error) notFound.message = error;
    throw notFound;
  }
  throw new Error(error || "Something went wrong. Nothing was changed.");
}

/** A multipart POST — the browser sets its own boundary, so no headers here. */
export async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: form });
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};

/** Where the website serves the photographs the admin previews. */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
