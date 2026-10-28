/**
 * Resend, the one door every email leaves by.
 *
 * Tested against a `fetch` that answers from a script, because what matters
 * is the request Resend is handed and what the server makes of each answer —
 * neither of which needs a network, and both of which used to be taken on
 * trust. Three things are worth more than the rest here: that the key never
 * appears in anything we log, that a rate limit does not quietly cost the
 * office an enquiry, and that a request nobody got an answer to is left
 * alone rather than sent twice.
 */

import { describe, expect, test } from "bun:test";

import { MAX_DETAIL } from "../src/lib/mail/mailer";
import { ResendMailer } from "../src/lib/mail/resend";

const KEY = "re_a_test_key_0123456789";
const FROM = "City Chauffeurs <bookings@citychauffeurs.example>";

const note = {
  to: "office@citychauffeurs.example",
  subject: "CC-1042 — enquiry from Amelia Hughes",
  text: "Amelia Hughes has sent an enquiry from the website.",
};

/** One scripted answer from Resend: a status and a body, or a failure to answer at all. */
type Answer = { status: number; body?: unknown } | { throws: Error };

function timeout(): Error {
  const error = new Error("The operation timed out.");
  error.name = "TimeoutError";
  return error;
}

/**
 * A mailer whose Resend is the script below, and which does not sleep between
 * tries — the backoff is a real second in production and nothing in a test.
 */
function scripted(...answers: Answer[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const queue = [...answers];

  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    const answer = queue.shift() ?? { status: 200, body: { id: "unscripted" } };
    if ("throws" in answer) throw answer.throws;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const mailer = new ResendMailer({ apiKey: KEY, from: FROM, fetch: fetcher, timeoutMs: 1_000, retryDelayMs: 0 });
  const sent = (index = 0) => JSON.parse(String(requests[index]!.init.body)) as Record<string, unknown>;
  const headers = (index = 0) => requests[index]!.init.headers as Record<string, string>;

  return { mailer, requests, sent, headers };
}

describe("the request Resend is handed", () => {
  test("is the email, addressed and signed with the key", async () => {
    const { mailer, requests, sent, headers } = scripted({ status: 200, body: { id: "e-1" } });

    expect(await mailer.send(note)).toEqual({ ok: true, id: "e-1" });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://api.resend.com/emails");
    expect(requests[0]!.init.method).toBe("POST");
    expect(headers().Authorization).toBe(`Bearer ${KEY}`);
    expect(headers()["Content-Type"]).toBe("application/json");
    expect(sent()).toEqual({
      from: FROM,
      to: ["office@citychauffeurs.example"],
      subject: note.subject,
      text: note.text,
    });
  });

  test("carries a reply address only when the email has one", async () => {
    const withReply = scripted();
    await withReply.mailer.send({ ...note, replyTo: "amelia@example.com" });
    expect(withReply.sent().reply_to).toBe("amelia@example.com");

    const without = scripted();
    await without.mailer.send(note);
    expect(without.sent()).not.toHaveProperty("reply_to");
  });

  test("gives up the id rather than inventing one, if Resend sends none", async () => {
    const { mailer } = scripted({ status: 200, body: {} });
    expect(await mailer.send(note)).toEqual({ ok: true, id: null });
  });
});

describe("when Resend refuses the message", () => {
  test("the failure is reported in Resend's own name and words", async () => {
    const { mailer } = scripted({
      status: 403,
      body: { statusCode: 403, name: "validation_error", message: "The citychauffeurs.example domain is not verified." },
    });

    expect(await mailer.send(note)).toEqual({
      ok: false,
      code: "resend_validation_error",
      detail: "The citychauffeurs.example domain is not verified.",
    });
  });

  test("a refusal with nothing to say still says which status it was", async () => {
    const { mailer } = scripted({ status: 402, body: {} });
    expect(await mailer.send(note)).toEqual({ ok: false, code: "resend_http_402", detail: "Resend answered 402." });
  });

  test("the key is never in what gets logged", async () => {
    const { mailer } = scripted({ status: 401, body: { name: "restricted_api_key", message: `Key ${KEY} may not send.` } });

    const outcome = await mailer.send(note);
    expect(outcome.ok).toBe(false);
    // Resend's words are repeated, so the one case that could carry the key
    // back to us is a provider that quotes it. It must not reach the log.
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  test("a long complaint is trimmed to something a log line can hold", async () => {
    const { mailer } = scripted({ status: 422, body: { name: "validation_error", message: "x".repeat(500) } });

    const outcome = await mailer.send(note);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.detail).toHaveLength(MAX_DETAIL);
  });

  test("a refusal that another go would not change is only attempted once", async () => {
    const { mailer, requests } = scripted({ status: 422, body: { name: "missing_required_field" } });

    await mailer.send(note);
    expect(requests).toHaveLength(1);
  });
});

describe("when Resend is busy", () => {
  test("a rate limit is waited out rather than losing the email", async () => {
    const { mailer, requests } = scripted(
      { status: 429, body: { name: "rate_limit_exceeded", message: "Too many requests." } },
      { status: 200, body: { id: "e-2" } },
    );

    expect(await mailer.send(note)).toEqual({ ok: true, id: "e-2" });
    expect(requests).toHaveLength(2);
    // The same email both times, not a half-built second one.
    expect(requests[0]!.init.body).toBe(requests[1]!.init.body);
  });

  test("a server error is given another go too", async () => {
    const { mailer, requests } = scripted({ status: 503, body: { name: "internal_server_error" } }, { status: 200, body: { id: "e-3" } });

    expect(await mailer.send(note)).toEqual({ ok: true, id: "e-3" });
    expect(requests).toHaveLength(2);
  });

  test("but it is three goes and no more, and the last answer is the one reported", async () => {
    const limited = { status: 429, body: { name: "rate_limit_exceeded", message: "Too many requests." } } as const;
    const { mailer, requests } = scripted(limited, limited, limited, { status: 200, body: { id: "never-reached" } });

    expect(await mailer.send(note)).toEqual({
      ok: false,
      code: "resend_rate_limit_exceeded",
      detail: "Too many requests.",
    });
    expect(requests).toHaveLength(3);
  });
});

describe("when there is no answer at all", () => {
  test("a timeout is not tried again, because Resend may already have it", async () => {
    const { mailer, requests } = scripted({ throws: timeout() }, { status: 200, body: { id: "would-be-a-duplicate" } });

    expect(await mailer.send(note)).toEqual({
      ok: false,
      code: "resend_timeout",
      detail: "Resend did not answer in time.",
    });
    expect(requests).toHaveLength(1);
  });

  test("nor is a request that never arrived", async () => {
    const { mailer, requests } = scripted({ throws: new TypeError("fetch failed") });

    expect(await mailer.send(note)).toEqual({
      ok: false,
      code: "resend_unreachable",
      detail: "Resend could not be reached.",
    });
    expect(requests).toHaveLength(1);
  });
});
