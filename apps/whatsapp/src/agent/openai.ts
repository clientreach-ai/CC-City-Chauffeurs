/**
 * OpenAI, behind the `ChatModel` seam.
 *
 * The only file in the application that knows what an OpenAI request looks
 * like. Everything else speaks the neutral types in `model.ts`.
 *
 * Choices made here, and why:
 *
 * - **The Responses API**, not chat completions. It is the current shape for
 *   tool use, it carries reasoning between the rounds of one turn, and its
 *   usage figures name the cached tokens.
 * - **`store: false`.** A customer's journey, their name and their telephone
 *   number are the client's to keep, in the client's database. Nothing is
 *   left on OpenAI's side to be listed later.
 * - **Strict tools.** Every tool is declared strict, which means the model
 *   is constrained to the schema rather than asked to respect it. Strict
 *   mode has rules of its own — every property required, no open objects —
 *   so the schema is rewritten for it below. What is enforced before a tool
 *   runs is still Zod, in `runTool`, unchanged.
 * - **Reasoning replayed within a turn.** The model's own items go back
 *   verbatim on the next round of the same turn, so the reasoning that chose
 *   a tool is still there when its result arrives. With `store: false` that
 *   only works if the encrypted reasoning is asked for, which is what
 *   `include` is for.
 * - **One request per round, and no hidden retries.** The SDK retries a
 *   connection failure twice; nothing here re-asks a model that answered.
 *   A refusal or a failure is the agent loop's business, which ends in a
 *   reply to the customer and a person taking over.
 */

import OpenAI from "openai";
import type {
  FunctionTool,
  Response,
  ResponseInput,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";

import {
  ModelUnavailableError,
  type ChatModel,
  type ModelMessage,
  type ModelRequest,
  type ModelResponse,
  type ModelTool,
  type ModelToolCall,
  type StopReason,
} from "./model";

export type OpenAIEffort = "none" | "low" | "medium" | "high";

export type OpenAIModelOptions = {
  /** Read from `OPENAI_API_KEY` when omitted. */
  apiKey?: string;
  model?: string;
  /** Reasoning effort. `none` also stops reasoning being asked for or replayed. */
  effort?: OpenAIEffort;
  maxOutputTokens?: number;
  /** Per request. A customer should not wait on a hung connection for long. */
  timeoutMs?: number;
  /** For tests: a client that is not the real one. */
  client?: OpenAI;
};

/**
 * A capable model at a price that suits a few hundred short conversations a
 * month, and one that reads a schema well enough to be trusted with tools.
 * `WHATSAPP_AI_MODEL` moves it either way without touching this file.
 */
export const DEFAULT_MODEL = "gpt-5.4-mini";

/**
 * A WhatsApp reply is a few sentences; the store refuses anything over 4,096
 * characters, which is about 1,200 tokens. The rest is headroom for
 * reasoning, which is spent from the same budget.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 3_000;

const DEFAULT_TIMEOUT_MS = 60_000;

/** Shared by every conversation, so the cached prefix is found again. */
const CACHE_KEY = "cc-whatsapp-assistant";

export class OpenAIModel implements ChatModel {
  readonly provider = "openai";
  readonly model: string;
  private readonly client: OpenAI;
  private readonly effort: OpenAIEffort;
  private readonly maxOutputTokens: number;

  constructor(options: OpenAIModelOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.effort = options.effort ?? "low";
    this.maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    this.client =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        // Connection failures and 429s only, and the SDK backs off between.
        maxRetries: 2,
      });
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const reasoning = this.effort !== "none";

    let response: Response;
    try {
      response = await this.client.responses.create({
        model: this.model,
        // The rules, identical on every turn, so the prefix caches.
        instructions: request.system,
        input: toInput(request.messages, request.context),
        tools: request.tools.map(toFunctionTool),
        max_output_tokens: this.maxOutputTokens,
        store: false,
        prompt_cache_key: CACHE_KEY,
        ...(reasoning
          ? { reasoning: { effort: this.effort }, include: ["reasoning.encrypted_content" as const] }
          : {}),
      });
    } catch (error) {
      throw toUnavailable(error);
    }

    const output = response.output ?? [];
    const refused = output.some(
      (item) => item.type === "message" && item.content.some((part) => part.type === "refusal"),
    );

    const usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cacheReadTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    };

    // A refusal can arrive with a half-finished turn beside it; none of it is
    // safe to act on or to show.
    if (refused) return { text: "", toolCalls: [], stopReason: "refusal", usage };

    const text = output
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .filter((part): part is Extract<typeof part, { type: "output_text" }> => part.type === "output_text")
      .map((part) => part.text)
      .join("")
      .trim();

    const toolCalls = output
      .filter((item): item is Extract<ResponseOutputItem, { type: "function_call" }> => item.type === "function_call")
      .map(toToolCall);

    return {
      text,
      toolCalls,
      stopReason: stopReasonOf(response, toolCalls.length),
      usage,
      // Reasoning is only replayable when it came back encrypted.
      replay: reasoning ? output : output.filter((item) => item.type !== "reasoning"),
    };
  }
}

function stopReasonOf(response: Response, toolCalls: number): StopReason {
  if (response.incomplete_details?.reason === "max_output_tokens") return "max_tokens";
  if (response.incomplete_details?.reason === "content_filter") return "refusal";
  if (toolCalls > 0) return "tool_use";
  if (response.status === "completed") return "end_turn";
  return "other";
}

/**
 * What the model asked for, as the loop reads it.
 *
 * Arguments that are not JSON are not guessed at. They come back as a shape
 * no tool accepts, so `runTool` refuses them the same way it refuses any
 * other bad arguments and the model is told what was wrong.
 */
function toToolCall(item: Extract<ResponseOutputItem, { type: "function_call" }>): ModelToolCall {
  let input: unknown;
  try {
    input = withoutNulls(JSON.parse(item.arguments || "{}"));
  } catch {
    input = { malformedArguments: item.arguments.slice(0, 200) };
  }
  return { id: item.call_id, name: item.name, input };
}

/**
 * Strict mode wants every property present, so an optional one is declared
 * nullable and the model fills in `null` where it has nothing. The tools are
 * written in terms of "absent", not "null" — `record_journey_details` must
 * not read a null as an instruction to erase a pickup address — so the nulls
 * are taken out again here, before anything neutral sees them.
 */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value === null || typeof value !== "object") return value;
  const kept: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item !== null) kept[key] = withoutNulls(item);
  }
  return kept;
}

function toFunctionTool(tool: ModelTool): FunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: strictSchema(tool.inputSchema),
    strict: true,
  };
}

/**
 * The keywords strict mode is defined over. Zod writes more than that —
 * lengths, minimums, formats — and a schema carrying them is rejected
 * outright, so they are dropped for the model's copy. Nothing is lost: the
 * arguments that come back are parsed by the Zod schema itself before a tool
 * runs, lengths and all.
 */
const STRICT_KEYWORDS = new Set([
  "type",
  "description",
  "enum",
  "const",
  "properties",
  "required",
  "items",
  "anyOf",
  "additionalProperties",
]);

function strictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (STRICT_KEYWORDS.has(key)) kept[key] = value;
  }

  if (Array.isArray(kept.anyOf)) {
    kept.anyOf = (kept.anyOf as Record<string, unknown>[]).map(strictSchema);
  }
  if (kept.items && typeof kept.items === "object") {
    kept.items = strictSchema(kept.items as Record<string, unknown>);
  }

  if (kept.properties && typeof kept.properties === "object") {
    const properties = kept.properties as Record<string, Record<string, unknown>>;
    const wasRequired = new Set(Array.isArray(kept.required) ? (kept.required as string[]) : []);
    const rewritten: Record<string, unknown> = {};
    for (const [name, property] of Object.entries(properties)) {
      const strict = strictSchema(property);
      rewritten[name] = wasRequired.has(name) ? strict : nullable(strict);
    }
    kept.properties = rewritten;
    // Every property required, and nothing beyond them.
    kept.required = Object.keys(properties);
    kept.additionalProperties = false;
  } else if (kept.type === "object") {
    kept.properties = {};
    kept.required = [];
    kept.additionalProperties = false;
  }

  return kept;
}

/** "This, or nothing" — how an optional field is said in strict mode. */
function nullable(schema: Record<string, unknown>): Record<string, unknown> {
  if (typeof schema.type === "string") return { ...schema, type: [schema.type, "null"] };
  if (Array.isArray(schema.anyOf)) {
    return { ...schema, anyOf: [...(schema.anyOf as unknown[]), { type: "null" }] };
  }
  return { anyOf: [schema, { type: "null" }] };
}

/**
 * The conversation as the Responses API takes it.
 *
 * `context` — today's date, the journey so far — goes last, after everything
 * said, rather than into `instructions`: the instructions are the cached
 * prefix and must not change between turns, and a note about the current
 * draft is most use to the model where it can see it plainly.
 */
function toInput(messages: ModelMessage[], context: string): ResponseInput {
  const input: ResponseInput = [];

  for (const message of messages) {
    switch (message.role) {
      case "user":
        input.push({ role: "user", content: message.text });
        break;
      case "assistant": {
        // Within a turn, the model's own items go back unchanged: a tool call
        // separated from the reasoning that made it is refused.
        if (message.replay) {
          input.push(...(message.replay as ResponseInputItem[]));
          break;
        }
        // History rebuilt from what was stored has no such items.
        if (message.text) input.push({ role: "assistant", content: message.text });
        for (const call of message.toolCalls) {
          input.push({
            type: "function_call",
            call_id: call.id,
            name: call.name,
            arguments: JSON.stringify(call.input ?? {}),
          });
        }
        break;
      }
      case "tool_results":
        for (const result of message.results) {
          input.push({ type: "function_call_output", call_id: result.callId, output: result.content });
        }
        break;
    }
  }

  if (context) input.push({ role: "developer", content: context });
  return input;
}

/**
 * Every failure the SDK can raise, reduced to a code worth recording. The
 * customer never sees any of it — they get the fallback reply, and a person.
 */
function toUnavailable(error: unknown): ModelUnavailableError {
  if (error instanceof OpenAI.AuthenticationError) return new ModelUnavailableError("model_auth", "The model key was rejected.");
  if (error instanceof OpenAI.PermissionDeniedError) return new ModelUnavailableError("model_forbidden", "The model key may not use this model.");
  if (error instanceof OpenAI.RateLimitError) return new ModelUnavailableError("model_rate_limited", "Rate limited.");
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new ModelUnavailableError("model_timeout", "Timed out.");
  if (error instanceof OpenAI.APIConnectionError) return new ModelUnavailableError("model_unreachable", "Could not connect.");
  if (error instanceof OpenAI.BadRequestError) return new ModelUnavailableError("model_bad_request", error.message);
  if (error instanceof OpenAI.APIError) return new ModelUnavailableError(`model_http_${error.status ?? "error"}`, error.message);
  return new ModelUnavailableError("model_error", error instanceof Error ? error.name : "Unknown error");
}
