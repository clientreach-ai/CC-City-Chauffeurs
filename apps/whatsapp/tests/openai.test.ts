/**
 * The OpenAI adapter, with a client that answers from a script.
 *
 * Two things are under test. What the assistant sends — the tools as strict
 * mode requires them, the conversation in the Responses API's own shapes,
 * the reasoning handed back within a turn — and what it makes of what comes
 * back, including the answers that are no use: a refusal, a cut-off reply,
 * arguments that are not JSON, and every way the request can fail.
 */

import { describe, expect, test } from "bun:test";
import OpenAI from "openai";

import { OpenAIModel } from "../src/agent/openai";
import { ModelUnavailableError, type ModelRequest, type ModelTool } from "../src/agent/model";
import { cityChauffeursTools } from "../src/tools/city-chauffeurs";
import { toModelTool } from "../src/tools/tool";

/** A client that returns what the test says, and keeps what it was asked. */
function fakeClient(answers: unknown[] | (() => never)) {
  const requests: any[] = [];
  const queue = Array.isArray(answers) ? [...answers] : answers;
  const client = {
    responses: {
      create: async (request: unknown) => {
        requests.push(request);
        if (typeof queue === "function") return queue();
        const next = queue.shift();
        if (!next) throw new Error("the fake client ran out of answers");
        return next;
      },
    },
  };
  return { client: client as unknown as OpenAI, requests };
}

const message = (text: string) => ({
  type: "message",
  role: "assistant",
  content: [{ type: "output_text", text }],
});

const functionCall = (name: string, input: unknown, callId = "call_1") => ({
  type: "function_call",
  call_id: callId,
  name,
  arguments: JSON.stringify(input),
});

const answer = (output: unknown[], extra: Record<string, unknown> = {}) => ({
  status: "completed",
  incomplete_details: null,
  output,
  usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 80 } },
  ...extra,
});

const request = (overrides: Partial<ModelRequest> = {}): ModelRequest => ({
  system: "You are the City Chauffeurs assistant.",
  context: "Today is 2027-01-10.",
  messages: [{ role: "user", text: "Hi" }],
  tools: [],
  ...overrides,
});

const tools = cityChauffeursTools.map(toModelTool);
const toolNamed = (name: string) => tools.find((tool) => tool.name === name)!;

describe("what comes back", () => {
  test("plain text is the reply, and the turn is over", async () => {
    const { client } = fakeClient([answer([message("Hello, how can I help?")])]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.text).toBe("Hello, how can I help?");
    expect(response.toolCalls).toEqual([]);
    expect(response.stopReason).toBe("end_turn");
  });

  test("tokens are counted, the cached ones apart", async () => {
    const { client } = fakeClient([answer([message("Hello.")])]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.usage).toEqual({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 80 });
  });

  test("usage that did not arrive is zero, not a crash", async () => {
    const { client } = fakeClient([{ status: "completed", output: [message("Hello.")] }]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });
  });

  test("a tool call is read with its arguments", async () => {
    const { client } = fakeClient([answer([functionCall("get_vehicle", { vehicle: "S Class" })])]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.stopReason).toBe("tool_use");
    expect(response.toolCalls).toEqual([{ id: "call_1", name: "get_vehicle", input: { vehicle: "S Class" } }]);
  });

  test("several tool calls in one round keep their own ids", async () => {
    const { client } = fakeClient([
      answer([
        functionCall("get_fleet", {}, "call_a"),
        functionCall("get_services", {}, "call_b"),
        message("Let me look."),
      ]),
    ]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.toolCalls.map((call) => [call.id, call.name])).toEqual([
      ["call_a", "get_fleet"],
      ["call_b", "get_services"],
    ]);
    // Text alongside a tool call is still the model's, and still read.
    expect(response.text).toBe("Let me look.");
  });

  test("a null stands for a field the model has nothing for", async () => {
    const { client } = fakeClient([
      answer([functionCall("record_journey_details", { pickup: "Heathrow", dropoff: null, passengers: 3, name: null })]),
    ]);
    const response = await new OpenAIModel({ client }).respond(request());

    // Absent, not null: a null must never read as "erase what you had".
    expect(response.toolCalls[0]!.input).toEqual({ pickup: "Heathrow", passengers: 3 });
  });

  test("arguments that are not JSON are refused, not guessed at", async () => {
    const { client } = fakeClient([
      answer([{ type: "function_call", call_id: "call_1", name: "get_vehicle", arguments: '{"vehicle": "S Cla' }]),
    ]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.toolCalls[0]!.input).toEqual({ malformedArguments: '{"vehicle": "S Cla' });
    // The shape no tool accepts: runTool answers invalid_arguments.
    expect(toolNamed("get_vehicle")).toBeDefined();
  });

  test("a refusal is a refusal, whatever else came with it", async () => {
    const { client } = fakeClient([
      answer([
        { type: "message", role: "assistant", content: [{ type: "refusal", refusal: "I can't help with that." }] },
        functionCall("create_enquiry", {}),
      ]),
    ]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.stopReason).toBe("refusal");
    expect(response.text).toBe("");
    // Nothing from a refused turn is acted on.
    expect(response.toolCalls).toEqual([]);
  });

  test("a reply cut off at the token limit says so", async () => {
    const { client } = fakeClient([
      answer([message("The Mercedes S-Class seats three and")], {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
    ]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response.stopReason).toBe("max_tokens");
  });

  test("a content filter is treated as a refusal", async () => {
    const { client } = fakeClient([
      answer([], { status: "incomplete", incomplete_details: { reason: "content_filter" } }),
    ]);
    expect((await new OpenAIModel({ client }).respond(request())).stopReason).toBe("refusal");
  });

  test("an answer with no output at all is neither text nor a crash", async () => {
    const { client } = fakeClient([answer([], { status: "failed" })]);
    const response = await new OpenAIModel({ client }).respond(request());

    expect(response).toMatchObject({ text: "", toolCalls: [], stopReason: "other" });
  });
});

describe("what is sent", () => {
  test("the rules are the instructions, and this turn's context comes last", async () => {
    const { client, requests } = fakeClient([answer([message("Hello.")])]);
    await new OpenAIModel({ client }).respond(
      request({ messages: [{ role: "user", text: "Hi" }, { role: "assistant", text: "Hello.", toolCalls: [] }, { role: "user", text: "What cars?" }] }),
    );

    const sent = requests[0];
    expect(sent.instructions).toBe("You are the City Chauffeurs assistant.");
    // The cached prefix must not carry a date that changes it every day.
    expect(sent.instructions).not.toContain("2027-01-10");
    expect(sent.input.at(-1)).toEqual({ role: "developer", content: "Today is 2027-01-10." });
    expect(sent.input.slice(0, 3)).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
      { role: "user", content: "What cars?" },
    ]);
  });

  test("a tool result is sent against the call it answers", async () => {
    const { client, requests } = fakeClient([answer([message("Two cars.")])]);
    await new OpenAIModel({ client }).respond(
      request({
        messages: [
          { role: "user", text: "What cars?" },
          { role: "assistant", text: "", toolCalls: [{ id: "call_1", name: "get_fleet", input: {} }] },
          { role: "tool_results", results: [{ callId: "call_1", content: '{"ok":true}', isError: false }] },
        ],
      }),
    );

    expect(requests[0].input).toContainEqual({ type: "function_call", call_id: "call_1", name: "get_fleet", arguments: "{}" });
    expect(requests[0].input).toContainEqual({ type: "function_call_output", call_id: "call_1", output: '{"ok":true}' });
  });

  test("the model's own items go back unchanged within a turn", async () => {
    const { client, requests } = fakeClient([
      answer([{ type: "reasoning", id: "rs_1", encrypted_content: "opaque" }, functionCall("get_fleet", {})]),
      answer([message("Two cars.")]),
    ]);
    const model = new OpenAIModel({ client });

    const first = await model.respond(request({ tools: [toolNamed("get_fleet")] }));
    await model.respond(
      request({
        messages: [
          { role: "user", text: "What cars?" },
          { role: "assistant", text: "", toolCalls: first.toolCalls, replay: first.replay },
          { role: "tool_results", results: [{ callId: "call_1", content: '{"ok":true}', isError: false }] },
        ],
      }),
    );

    // The reasoning that chose the call is still beside it on the next round.
    expect(requests[1].input[0]).toEqual({ role: "user", content: "What cars?" });
    expect(requests[1].input[1]).toEqual({ type: "reasoning", id: "rs_1", encrypted_content: "opaque" });
    expect(requests[1].input[2]).toMatchObject({ type: "function_call", call_id: "call_1" });
  });

  test("nothing of the customer is left on OpenAI's side", async () => {
    const { client, requests } = fakeClient([answer([message("Hello.")])]);
    await new OpenAIModel({ client }).respond(request());

    expect(requests[0].store).toBe(false);
  });

  test("reasoning is asked for, and asked back, only when it is wanted", async () => {
    const { client: on, requests: withReasoning } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client: on, effort: "medium" }).respond(request());
    expect(withReasoning[0].reasoning).toEqual({ effort: "medium" });
    expect(withReasoning[0].include).toEqual(["reasoning.encrypted_content"]);

    const { client: off, requests: without } = fakeClient([
      answer([{ type: "reasoning", id: "rs_1" }, message("Hi.")]),
    ]);
    const response = await new OpenAIModel({ client: off, effort: "none" }).respond(request());
    expect(without[0].reasoning).toBeUndefined();
    expect(without[0].include).toBeUndefined();
    // Nothing to replay: an unencrypted reasoning item cannot be sent back.
    expect(response.replay).toEqual([message("Hi.")]);
  });

  test("the model and its ceiling are the configured ones", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    const model = new OpenAIModel({ client, model: "gpt-5.4", maxOutputTokens: 1234 });
    await model.respond(request());

    expect(model.model).toBe("gpt-5.4");
    expect(model.provider).toBe("openai");
    expect(requests[0]).toMatchObject({ model: "gpt-5.4", max_output_tokens: 1234 });
  });
});

describe("the tools, as strict mode requires them", () => {
  test("every tool is strict, with no room for a field nobody declared", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client }).respond(request({ tools }));

    for (const tool of requests[0].tools) {
      expect(tool.type).toBe("function");
      expect(tool.strict).toBe(true);
      expect(tool.parameters.additionalProperties).toBe(false);
      // Strict mode: every property declared is a property required.
      expect(new Set(tool.parameters.required)).toEqual(new Set(Object.keys(tool.parameters.properties)));
    }
  });

  test("an optional field becomes one the model may answer with nothing", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client }).respond(request({ tools: [toolNamed("record_journey_details")] }));

    const { properties, required } = requests[0].tools[0].parameters;
    expect(required).toContain("pickup");
    expect(properties.pickup.type).toEqual(["string", "null"]);
    expect(properties.passengers.type).toEqual(["integer", "null"]);
    // The description is what tells the model what the field is for.
    expect(properties.date.description).toContain("YYYY-MM-DD");
  });

  test("a required field stays required, and an enum stays an enum", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client }).respond(request({ tools: [toolNamed("handoff_to_human")] }));

    const { properties } = requests[0].tools[0].parameters;
    expect(properties.reason.type).toBe("string");
    expect(properties.reason.enum).toContain("complaint");
    expect(properties.summary.type).toBe("string");
  });

  test("lengths and limits are dropped for the model, and still enforced before a tool runs", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client }).respond(request({ tools: [toolNamed("get_vehicle")] }));

    // Strict mode rejects a schema carrying these outright.
    const sent = JSON.stringify(requests[0].tools[0].parameters);
    expect(sent).not.toContain("maxLength");
    expect(sent).not.toContain("minLength");
    // The real limits live in the Zod schema, which is what runTool parses with.
    const schema = cityChauffeursTools.find((tool) => tool.name === "get_vehicle")!.input;
    expect(schema.safeParse({ vehicle: "x".repeat(200) }).success).toBe(false);
    expect(schema.safeParse({ vehicle: "S Class" }).success).toBe(true);
  });

  test("a tool that takes nothing says so in the way strict mode understands", async () => {
    const { client, requests } = fakeClient([answer([message("Hi.")])]);
    await new OpenAIModel({ client }).respond(request({ tools: [toolNamed("create_enquiry")] }));

    expect(requests[0].tools[0].parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });
});

describe("when the request fails", () => {
  const headers = new Headers();
  const failing = (error: unknown) => new OpenAIModel({ client: fakeClient(() => { throw error; }).client });

  const cases: [string, unknown, string][] = [
    ["a rejected key", new OpenAI.AuthenticationError(401, undefined, "no", headers), "model_auth"],
    ["a model this key may not use", new OpenAI.PermissionDeniedError(403, undefined, "no", headers), "model_forbidden"],
    ["too many requests", new OpenAI.RateLimitError(429, undefined, "slow down", headers), "model_rate_limited"],
    ["a timeout", new OpenAI.APIConnectionTimeoutError({ message: "timed out" }), "model_timeout"],
    ["no connection", new OpenAI.APIConnectionError({ message: "offline" }), "model_unreachable"],
    ["a request OpenAI would not read", new OpenAI.BadRequestError(400, undefined, "bad schema", headers), "model_bad_request"],
    ["something else entirely", new TypeError("undefined is not a function"), "model_error"],
  ];

  for (const [name, error, code] of cases) {
    test(`${name} is recorded as ${code}`, async () => {
      const attempt = failing(error).respond(request());
      await expect(attempt).rejects.toBeInstanceOf(ModelUnavailableError);
      await expect(attempt).rejects.toMatchObject({ code });
    });
  }

  test("the detail never carries the key", async () => {
    const error = new OpenAI.AuthenticationError(401, undefined, "Incorrect API key provided: sk-proj-secret", headers);
    await expect(failing(error).respond(request())).rejects.toMatchObject({
      message: "The model key was rejected.",
    });
  });
});

describe("the seam itself", () => {
  test("a tool reaches the model as JSON Schema, whatever the model is", () => {
    const tool: ModelTool = toModelTool(cityChauffeursTools[0]!);
    expect(tool).toMatchObject({ name: expect.any(String), description: expect.any(String) });
    expect(tool.inputSchema.type).toBe("object");
  });
});
