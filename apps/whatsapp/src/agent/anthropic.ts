/**
 * Claude, behind the `ChatModel` seam.
 *
 * The only file in the application that knows what a Claude request looks
 * like. Everything else speaks the neutral types in `model.ts`.
 *
 * Choices made here, and why:
 *
 * - **Claude Opus 5 by default**, configurable. Adaptive thinking is on by
 *   default for this model, which is right for a conversation that has to
 *   decide when it has enough to record an enquiry.
 * - **Effort defaults to `medium`.** A reply on WhatsApp is short and a
 *   customer is waiting for it; the depth of `high` buys little here. It is a
 *   setting, not a constant.
 * - **Server-side refusal fallbacks on.** If Opus 5's safety classifiers
 *   decline a turn, the API re-runs it on the model Anthropic recommends for
 *   that category rather than returning nothing — a customer asking about a
 *   car should never get silence because of a false positive.
 * - **The system prompt is cached.** It is the same on every turn of every
 *   conversation, and the tools render in a fixed order, so the prefix is
 *   byte-stable.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessageParam,
  BetaTool,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import {
  ModelUnavailableError,
  type ChatModel,
  type ModelMessage,
  type ModelRequest,
  type ModelResponse,
  type ModelTool,
  type StopReason,
} from "./model";

export type AnthropicModelOptions = {
  /** Read from `ANTHROPIC_API_KEY` when omitted. */
  apiKey?: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  /** Per request. A customer should not wait on a hung connection for long. */
  timeoutMs?: number;
  /** For tests: a client that is not the real one. */
  client?: Anthropic;
};

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicModel implements ChatModel {
  readonly provider = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: "low" | "medium" | "high";
  private readonly maxTokens: number;

  constructor(options: AnthropicModelOptions = {}) {
    this.model = options.model ?? "claude-opus-5";
    this.effort = options.effort ?? "medium";
    // Non-streaming: a WhatsApp reply is a few sentences, and 16k leaves
    // room for thinking without ever cutting a reply off mid-thought.
    this.maxTokens = options.maxTokens ?? 16_000;
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? 60_000,
        // The SDK retries 429, 5xx and dropped connections itself.
        maxRetries: 2,
      });
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    let message;
    try {
      message = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: this.effort },
        // The rules are cached; this turn's context follows the marker so a
        // changing draft never invalidates them.
        system: [
          { type: "text", text: request.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: request.context },
        ],
        tools: request.tools.map(toTool),
        messages: toMessages(request.messages),
      });
    } catch (error) {
      throw toUnavailable(error);
    }

    const stopReason = toStopReason(message.stop_reason);
    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    };

    // A refusal can arrive with a partial turn in `content`; none of it is
    // safe to act on or to show.
    if (stopReason === "refusal") {
      return { text: "", toolCalls: [], stopReason, usage };
    }

    const text = message.content
      .filter((block): block is Extract<BetaContentBlock, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const toolCalls = message.content
      .filter((block): block is Extract<BetaContentBlock, { type: "tool_use" }> => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name, input: block.input }));

    return { text, toolCalls, stopReason, usage, replay: replayable(message.content) };
  }
}

function toTool(tool: ModelTool): BetaTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as BetaTool.InputSchema,
  };
}

function toMessages(messages: ModelMessage[]): BetaMessageParam[] {
  return messages.map((message): BetaMessageParam => {
    switch (message.role) {
      case "user":
        return { role: "user", content: message.text };
      case "assistant": {
        // Within a turn, hand the model's own blocks back unchanged: with
        // thinking on, a tool call separated from the reasoning that made it
        // is refused. History rebuilt from stored text has no such blocks.
        if (message.replay) {
          return { role: "assistant", content: message.replay as BetaContentBlockParam[] };
        }
        const content: BetaContentBlockParam[] = [];
        if (message.text) content.push({ type: "text", text: message.text });
        for (const call of message.toolCalls) {
          content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input as Record<string, unknown> });
        }
        return { role: "assistant", content };
      }
      case "tool_results":
        // Every result from one round in a single user message — splitting
        // them teaches the model to stop calling tools in parallel.
        return {
          role: "user",
          content: message.results.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.callId,
            content: result.content,
            is_error: result.isError,
          })),
        };
    }
  });
}

/**
 * The response's blocks, as they may be sent back.
 *
 * After a server-side fallback the content can carry a `fallback` marker.
 * Reasoning and tool calls from before the last marker belonged to the model
 * that declined, and are not echoed; text, and everything after the marker,
 * is. The marker itself is an audit record and is dropped.
 */
function replayable(content: BetaContentBlock[]): BetaContentBlockParam[] {
  const boundary = content.findLastIndex((block) => block.type === "fallback");
  return content
    .filter((block, index) => {
      if (block.type === "fallback") return false;
      if (index < boundary) return block.type === "text";
      return true;
    })
    .map((block) => block as unknown as BetaContentBlockParam);
}

function toStopReason(reason: string | null): StopReason {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
    case "refusal":
      return reason;
    default:
      return "other";
  }
}

/**
 * Every failure the SDK can raise, reduced to a code worth recording. The
 * customer never sees any of it — they get the fallback reply.
 */
function toUnavailable(error: unknown): ModelUnavailableError {
  if (error instanceof Anthropic.AuthenticationError) return new ModelUnavailableError("model_auth", "The model key was rejected.");
  if (error instanceof Anthropic.RateLimitError) return new ModelUnavailableError("model_rate_limited", "Rate limited.");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ModelUnavailableError("model_timeout", "Timed out.");
  if (error instanceof Anthropic.APIConnectionError) return new ModelUnavailableError("model_unreachable", "Could not connect.");
  if (error instanceof Anthropic.BadRequestError) return new ModelUnavailableError("model_bad_request", error.message);
  if (error instanceof Anthropic.APIError) return new ModelUnavailableError(`model_http_${error.status ?? "error"}`, error.message);
  return new ModelUnavailableError("model_error", error instanceof Error ? error.name : "Unknown error");
}
