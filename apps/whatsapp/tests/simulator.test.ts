import { describe, expect, test } from "bun:test";
import { normalisePhone } from "../src/phone";
import { WebhookAuthenticationError, WebhookPayloadError } from "../src/ports";
import { SimulatorProvider, simulatorSignature } from "../src/providers/simulator";

const OUR_NUMBER = normalisePhone("+442084433332");
const SECRET = "simulator-secret";
const URL = "http://localhost:3000/api/whatsapp/simulator";

const text = (overrides: Record<string, unknown> = {}) => ({
  id: "sim-1",
  from: "+447700900321",
  to: "+442084433332",
  name: "Amelia",
  type: "text",
  text: "Hello",
  ...overrides,
});

const payload = (...messages: unknown[]) => JSON.stringify({ messages });

describe("verifySignature", () => {
  const body = payload(text());

  test("with a secret, accepts a correctly signed body", () => {
    const simulator = new SimulatorProvider({ secret: SECRET, ourNumber: OUR_NUMBER });
    const headers = new Headers({ "x-simulator-signature": simulatorSignature(body, SECRET) });
    expect(() => simulator.verifySignature({ url: URL, body, headers })).not.toThrow();
  });

  test("with a secret, refuses an unsigned body", () => {
    const simulator = new SimulatorProvider({ secret: SECRET, ourNumber: OUR_NUMBER });
    expect(() => simulator.verifySignature({ url: URL, body, headers: new Headers() })).toThrow(
      WebhookAuthenticationError,
    );
  });

  test("with a secret, refuses a bad or tampered signature", () => {
    const simulator = new SimulatorProvider({ secret: SECRET, ourNumber: OUR_NUMBER });
    for (const signature of [
      simulatorSignature(body, "another-secret"),
      simulatorSignature(payload(text({ text: "Goodbye" })), SECRET),
      simulatorSignature(body, SECRET).replace("sha256=", ""),
      "sha256=nonsense",
    ]) {
      const headers = new Headers({ "X-Simulator-Signature": signature });
      expect(() => simulator.verifySignature({ url: URL, body, headers })).toThrow(WebhookAuthenticationError);
    }
  });

  test("the signature is sha256= and the hex HMAC of the body", () => {
    expect(simulatorSignature(body, SECRET)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  test("without a secret, accepts anything (local development only)", () => {
    const simulator = new SimulatorProvider({ ourNumber: OUR_NUMBER });
    expect(() => simulator.verifySignature({ url: URL, body, headers: new Headers() })).not.toThrow();
  });
});

describe("parseInbound", () => {
  const simulator = new SimulatorProvider({ ourNumber: OUR_NUMBER });

  test("reads a text message", () => {
    const [message] = simulator.parseInbound(payload(text()));
    expect(message).toMatchObject({
      provider: "simulator",
      providerMessageId: "sim-1",
      from: "+447700900321",
      to: "+442084433332",
      profileName: "Amelia",
      kind: "text",
      text: "Hello",
    });
  });

  test("reads several messages in one body", () => {
    const messages = simulator.parseInbound(payload(text(), text({ id: "sim-2", text: "Are you there?" })));
    expect(messages.map((m) => m.providerMessageId)).toEqual(["sim-1", "sim-2"]);
  });

  test("addresses a message to our number when it leaves to out", () => {
    const { to: _, ...withoutTo } = text();
    expect(simulator.parseInbound(payload(withoutTo))[0]?.to).toBe(OUR_NUMBER);
  });

  test("normalises the numbers", () => {
    const [message] = simulator.parseInbound(payload(text({ from: "0044 7700 900321", to: "+44 20 8443 3332" })));
    expect(message?.from).toBe(normalisePhone("+447700900321"));
    expect(message?.to).toBe(OUR_NUMBER);
  });

  test("a type other than text is unsupported", () => {
    const [message] = simulator.parseInbound(payload(text({ type: "image", text: "A caption" })));
    expect(message?.kind).toBe("unsupported");
    expect(message?.text).toBe("A caption");
  });

  test("a missing name is null", () => {
    const { name: _, ...withoutName } = text();
    expect(simulator.parseInbound(payload(withoutName))[0]?.profileName).toBeNull();
  });

  test("refuses what is not a simulator payload", () => {
    for (const body of [
      "not json",
      "[]",
      JSON.stringify({}),
      JSON.stringify({ messages: [text()], extra: true }),
      payload(text({ extra: true })),
      payload(text({ id: "" })),
      payload(text({ from: "07700 900321" })),
      payload(text({ from: "+4412" })),
      payload(text({ to: "nobody" })),
      payload(text({ text: 42 })),
    ]) {
      expect(() => simulator.parseInbound(body)).toThrow(WebhookPayloadError);
    }
  });

  test("bounds the number of messages and the length of each", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => text({ id: `sim-${i}` }));
    expect(simulator.parseInbound(payload(...fifty))).toHaveLength(50);
    expect(() => simulator.parseInbound(payload(...fifty, text({ id: "sim-51" })))).toThrow(WebhookPayloadError);

    expect(simulator.parseInbound(payload(text({ text: "a".repeat(4096) })))[0]?.text).toHaveLength(4096);
    expect(() => simulator.parseInbound(payload(text({ text: "a".repeat(4097) })))).toThrow(WebhookPayloadError);
  });
});

describe("send", () => {
  const to = normalisePhone("+447700900321");

  test("records what was sent and numbers each message", async () => {
    const simulator = new SimulatorProvider({ ourNumber: OUR_NUMBER });
    expect(await simulator.send({ to, body: "First" })).toEqual({ ok: true, providerMessageId: "sim-out-1" });
    expect(await simulator.send({ to, body: "Second" })).toEqual({ ok: true, providerMessageId: "sim-out-2" });
    expect(simulator.sent).toEqual([
      { to, body: "First" },
      { to, body: "Second" },
    ]);
  });

  test("failNext scripts the next results, in order, then sending resumes", async () => {
    const simulator = new SimulatorProvider({ ourNumber: OUR_NUMBER });
    simulator.failNext(
      { ok: false, retryable: true, code: "provider_timeout", detail: "Timed out." },
      { ok: false, retryable: false, code: "twilio_63016", detail: "Outside the window." },
    );
    expect(await simulator.send({ to, body: "One" })).toMatchObject({ ok: false, code: "provider_timeout" });
    expect(await simulator.send({ to, body: "Two" })).toMatchObject({ ok: false, code: "twilio_63016" });
    expect(simulator.sent).toEqual([]);
    expect(await simulator.send({ to, body: "Three" })).toEqual({ ok: true, providerMessageId: "sim-out-1" });
    expect(simulator.sent).toEqual([{ to, body: "Three" }]);
  });

  test("clear forgets what was sent and anything scripted", async () => {
    const simulator = new SimulatorProvider({ ourNumber: OUR_NUMBER });
    await simulator.send({ to, body: "Before" });
    simulator.failNext({ ok: false, retryable: true, code: "provider_timeout", detail: "Timed out." });
    simulator.clear();
    expect(simulator.sent).toEqual([]);
    expect(await simulator.send({ to, body: "After" })).toEqual({ ok: true, providerMessageId: "sim-out-1" });
  });
});
