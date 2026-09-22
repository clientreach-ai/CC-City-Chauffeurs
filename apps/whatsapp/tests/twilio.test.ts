import { describe, expect, test } from "bun:test";
import { normalisePhone } from "../src/phone";
import { WebhookAuthenticationError, WebhookPayloadError } from "../src/ports";
import { TwilioProvider, twilioSignature } from "../src/providers/twilio";

const ACCOUNT_SID = "AC00000000000000000000000000000000";
const AUTH_TOKEN = "test-auth-token";
const OUR_NUMBER = normalisePhone("+442084433332");
const WEBHOOK_URL = "https://citychauffeurs.example/api/whatsapp/twilio";

const provider = (fetchImpl?: typeof fetch) =>
  new TwilioProvider({ accountSid: ACCOUNT_SID, authToken: AUTH_TOKEN, from: OUR_NUMBER, fetch: fetchImpl });

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

const inboundText = {
  MessageSid: "SM11111111111111111111111111111111",
  SmsMessageSid: "SM11111111111111111111111111111111",
  AccountSid: ACCOUNT_SID,
  From: "whatsapp:+447700900321",
  To: "whatsapp:+442084433332",
  Body: "Hello, can I book a car to Heathrow?",
  NumMedia: "0",
  ProfileName: "Amelia",
  WaId: "447700900321",
};

const signedRequest = (body: string, url = WEBHOOK_URL, headerName = "X-Twilio-Signature") => ({
  url,
  body,
  headers: new Headers({ [headerName]: twilioSignature(url, new URLSearchParams(body), AUTH_TOKEN) }),
});

describe("twilioSignature", () => {
  // Twilio's published example, which has appeared with two sets of numbers:
  // the one in its SDKs' own test suites, and the one on its current
  // documentation page. Both are reproduced exactly, which is the best
  // evidence there is that the algorithm is Twilio's.
  const documented = (caller: string) => ({
    CallSid: "CA1234567890ABCDE",
    Caller: caller,
    Digits: "1234",
    From: caller,
    To: "+18005551212",
  });

  test("reproduces the example in Twilio's SDK test suites exactly", () => {
    expect(twilioSignature("https://mycompany.com/myapp.php?foo=1&bar=2", documented("+14158675309"), "12345")).toBe(
      "RSOYDt4T1cUTdK1PDd93/VVr8B8=",
    );
  });

  test("reproduces the example on Twilio's documentation page exactly", () => {
    expect(twilioSignature("https://mycompany.com/myapp.php?foo=1&bar=2", documented("+12349013030"), "12345")).toBe(
      "0/KCTR6DLpKmkAf8muzZqo1nDgQ=",
    );
  });

  test("verifySignature accepts the documented request", () => {
    const twilio = new TwilioProvider({ accountSid: ACCOUNT_SID, authToken: "12345", from: OUR_NUMBER });
    expect(() =>
      twilio.verifySignature({
        url: "https://mycompany.com/myapp.php?foo=1&bar=2",
        body: form(documented("+14158675309")),
        headers: new Headers({ "X-Twilio-Signature": "RSOYDt4T1cUTdK1PDd93/VVr8B8=" }),
      }),
    ).not.toThrow();
  });

  test("does not depend on the order the parameters were sent in", () => {
    const a = twilioSignature(WEBHOOK_URL, [["b", "2"], ["a", "1"]], AUTH_TOKEN);
    const b = twilioSignature(WEBHOOK_URL, [["a", "1"], ["b", "2"]], AUTH_TOKEN);
    expect(a).toBe(b);
  });

  test("includes every value of a repeated name", () => {
    const once = twilioSignature(WEBHOOK_URL, [["a", "1"]], AUTH_TOKEN);
    const twice = twilioSignature(WEBHOOK_URL, [["a", "1"], ["a", "2"]], AUTH_TOKEN);
    expect(once).not.toBe(twice);
  });
});

describe("verifySignature", () => {
  const body = form(inboundText);

  test("accepts a request Twilio signed", () => {
    expect(() => provider().verifySignature(signedRequest(body))).not.toThrow();
  });

  test("looks the header up regardless of case", () => {
    expect(() => provider().verifySignature(signedRequest(body, WEBHOOK_URL, "x-twilio-signature"))).not.toThrow();
    expect(() => provider().verifySignature(signedRequest(body, WEBHOOK_URL, "X-TWILIO-SIGNATURE"))).not.toThrow();
  });

  test("refuses a body changed after signing", () => {
    const request = signedRequest(body);
    const tampered = { ...request, body: form({ ...inboundText, Body: "Cancel everything" }) };
    expect(() => provider().verifySignature(tampered)).toThrow(WebhookAuthenticationError);
  });

  test("refuses a signature computed over another URL", () => {
    const request = signedRequest(body, "http://internal:3000/api/whatsapp/twilio");
    expect(() => provider().verifySignature({ ...request, url: WEBHOOK_URL })).toThrow(WebhookAuthenticationError);
  });

  test("refuses a request with no signature", () => {
    expect(() => provider().verifySignature({ url: WEBHOOK_URL, body, headers: new Headers() })).toThrow(
      WebhookAuthenticationError,
    );
  });

  test("refuses a signature that differs only in its last character", () => {
    const good = twilioSignature(WEBHOOK_URL, new URLSearchParams(body), AUTH_TOKEN);
    const last = good.at(-1) === "A" ? "B" : "A";
    const headers = new Headers({ "X-Twilio-Signature": good.slice(0, -1) + last });
    expect(() => provider().verifySignature({ url: WEBHOOK_URL, body, headers })).toThrow(WebhookAuthenticationError);
  });

  test("refuses a signature of the wrong length", () => {
    const good = twilioSignature(WEBHOOK_URL, new URLSearchParams(body), AUTH_TOKEN);
    const headers = new Headers({ "X-Twilio-Signature": `${good}=` });
    expect(() => provider().verifySignature({ url: WEBHOOK_URL, body, headers })).toThrow(WebhookAuthenticationError);
  });

  test("refuses a signature made with another token", () => {
    const headers = new Headers({
      "X-Twilio-Signature": twilioSignature(WEBHOOK_URL, new URLSearchParams(body), "someone-elses-token"),
    });
    expect(() => provider().verifySignature({ url: WEBHOOK_URL, body, headers })).toThrow(WebhookAuthenticationError);
  });
});

describe("parseInbound", () => {
  test("reads a text message, with its numbers in E.164", () => {
    const [message, ...rest] = provider().parseInbound(form(inboundText));
    expect(rest).toHaveLength(0);
    expect(message).toMatchObject({
      provider: "twilio",
      providerMessageId: inboundText.MessageSid,
      from: "+447700900321",
      to: "+442084433332",
      profileName: "Amelia",
      kind: "text",
      text: inboundText.Body,
    });
    expect(message?.receivedAt).toBeInstanceOf(Date);
  });

  test("falls back to SmsMessageSid", () => {
    const { MessageSid: _, ...fields } = inboundText;
    expect(provider().parseInbound(form(fields))[0]?.providerMessageId).toBe(inboundText.SmsMessageSid);
  });

  test("a missing profile name is null", () => {
    const { ProfileName: _, ...fields } = inboundText;
    expect(provider().parseInbound(form(fields))[0]?.profileName).toBeNull();
  });

  test("a photograph is unsupported, but its caption is kept", () => {
    const [message] = provider().parseInbound(
      form({ ...inboundText, Body: "This is the address", NumMedia: "1", MediaContentType0: "image/jpeg" }),
    );
    expect(message?.kind).toBe("unsupported");
    expect(message?.text).toBe("This is the address");
  });

  test("a message with no text is unsupported", () => {
    const [message] = provider().parseInbound(form({ ...inboundText, Body: "", NumMedia: "1" }));
    expect(message?.kind).toBe("unsupported");
    expect(message?.text).toBe("");
  });

  test("a status callback is acknowledged and ignored", () => {
    const body = form({
      MessageSid: "SM22222222222222222222222222222222",
      MessageStatus: "delivered",
      AccountSid: ACCOUNT_SID,
      From: "whatsapp:+442084433332",
      To: "whatsapp:+447700900321",
    });
    expect(provider().parseInbound(body)).toEqual([]);
  });

  test("a message without a MessageSid is refused", () => {
    const { MessageSid: _, SmsMessageSid: __, ...fields } = inboundText;
    expect(() => provider().parseInbound(form(fields))).toThrow(WebhookPayloadError);
  });

  test("a message without From or To is refused", () => {
    const { From: _, ...noFrom } = inboundText;
    const { To: __, ...noTo } = inboundText;
    expect(() => provider().parseInbound(form(noFrom))).toThrow(WebhookPayloadError);
    expect(() => provider().parseInbound(form(noTo))).toThrow(WebhookPayloadError);
  });

  test("a message from an invalid number is refused", () => {
    expect(() => provider().parseInbound(form({ ...inboundText, From: "whatsapp:+4412" }))).toThrow(
      WebhookPayloadError,
    );
  });

  test("text is capped at 4096 characters", () => {
    const [message] = provider().parseInbound(form({ ...inboundText, Body: "a".repeat(5000) }));
    expect(message?.text).toHaveLength(4096);
  });
});

describe("send", () => {
  type Call = { url: string; init: RequestInit };

  const fakeFetch = (respond: () => Response | Promise<Response>) => {
    const calls: Call[] = [];
    const impl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return respond();
    }) as typeof fetch;
    return { calls, impl };
  };

  const json = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

  const to = normalisePhone("+447700900321");

  test("posts the message to Twilio and returns its sid", async () => {
    const { calls, impl } = fakeFetch(() => json(201, { sid: "SM33333333333333333333333333333333" }));
    const result = await provider(impl).send({ to, body: "Your enquiry is CC-1234." });

    expect(result).toEqual({ ok: true, providerMessageId: "SM33333333333333333333333333333333" });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`);
    expect(call?.init.method).toBe("POST");
    const headers = new Headers(call?.init.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
    );
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    const sent = new URLSearchParams(String(call?.init.body));
    expect(sent.get("From")).toBe("whatsapp:+442084433332");
    expect(sent.get("To")).toBe("whatsapp:+447700900321");
    expect(sent.get("Body")).toBe("Your enquiry is CC-1234.");
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  test("too many requests may be retried", async () => {
    const { impl } = fakeFetch(() => json(429, { code: 20429, message: "Too Many Requests", status: 429 }));
    const result = await provider(impl).send({ to, body: "Hello" });
    expect(result).toMatchObject({ ok: false, retryable: true, code: "twilio_20429" });
  });

  test("trouble on Twilio's side may be retried", async () => {
    const { impl } = fakeFetch(() => new Response("Bad gateway", { status: 502 }));
    const result = await provider(impl).send({ to, body: "Hello" });
    expect(result).toMatchObject({ ok: false, retryable: true, code: "http_502" });
  });

  test("a message outside the 24-hour window is not retried", async () => {
    const { impl } = fakeFetch(() =>
      json(400, {
        code: 63016,
        message: "Failed to send freeform message because you are outside the allowed window.",
        status: 400,
      }),
    );
    const result = await provider(impl).send({ to, body: "Hello" });
    expect(result).toMatchObject({ ok: false, retryable: false, code: "twilio_63016" });
    if (!result.ok) {
      expect(result.detail).toContain("outside the allowed window");
      expect(result.detail).not.toContain(AUTH_TOKEN);
    }
  });

  test("a timeout may be retried", async () => {
    const { impl } = fakeFetch(() => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    const result = await provider(impl).send({ to, body: "Hello" });
    expect(result).toMatchObject({ ok: false, retryable: true, code: "provider_timeout" });
  });

  test("a real timeout is enforced", async () => {
    const impl = ((_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;
    const twilio = new TwilioProvider({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      from: OUR_NUMBER,
      fetch: impl,
      timeoutMs: 20,
    });
    expect(await twilio.send({ to, body: "Hello" })).toMatchObject({
      ok: false,
      retryable: true,
      code: "provider_timeout",
    });
  });

  test("a network failure may be retried and is never thrown", async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    const result = await provider(impl).send({ to, body: "Hello" });
    expect(result).toMatchObject({ ok: false, retryable: true, code: "provider_unreachable" });
  });
});
