/**
 * The model, as the agent sees it.
 *
 * Vendor-neutral on purpose. The agent loop, the tools and the tests speak in
 * these types; exactly one file — `anthropic.ts` — knows what a Claude
 * request looks like. That is what lets a test put a scripted model in its
 * place and assert on every request, and what keeps the model a configuration
 * choice rather than something written into the conversation logic.
 */

/** A tool as the model is shown it. `inputSchema` is JSON Schema. */
export type ModelTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ModelToolCall = {
  id: string;
  name: string;
  /** Untrusted: whatever the model produced. Validated before anything runs. */
  input: unknown;
};

export type ModelToolResult = {
  callId: string;
  /** JSON, always — the `{ ok, ... }` envelope the tool returned. */
  content: string;
  isError: boolean;
};

export type ModelMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      toolCalls: ModelToolCall[];
      /**
       * The provider's own record of this turn, replayed verbatim on the next
       * request of the same turn. With thinking on, the reasoning that led to
       * a tool call has to be handed back with the call, unchanged, or the
       * continuation is refused; only the adapter knows what that looks like.
       * Absent for history rebuilt from stored text, which never needs it.
       */
      replay?: unknown;
    }
  | { role: "tool_results"; results: ModelToolResult[] };

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export type ModelResponse = {
  text: string;
  toolCalls: ModelToolCall[];
  stopReason: StopReason;
  usage: ModelUsage;
  replay?: unknown;
};

export type ModelRequest = {
  /**
   * Identical on every turn of every conversation: who the assistant is and
   * the rules it keeps. Cached, so it must never carry anything that changes.
   */
  system: string;
  /**
   * What is true for this turn only — today's date, what the customer has
   * said so far, what is still missing. Kept apart from `system` so the
   * cached prefix survives a changing draft.
   */
  context: string;
  messages: ModelMessage[];
  tools: ModelTool[];
};

export interface ChatModel {
  /** Which adapter — "anthropic", "scripted". Recorded on every run. */
  readonly provider: string;
  /** The model id in use, recorded on every run. */
  readonly model: string;
  respond(request: ModelRequest): Promise<ModelResponse>;
}

/** The model could not be reached, or refused the request outright. The customer gets a fallback. */
export class ModelUnavailableError extends Error {
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "ModelUnavailableError";
  }
}
