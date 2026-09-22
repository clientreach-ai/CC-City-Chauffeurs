/**
 * One turn of the conversation: the model, its tools, and a reply.
 *
 * The loop is ours rather than an SDK helper's because every step of it is
 * something we record or decide: each tool call is timed and kept on the
 * run, a refused argument goes back to the model with the reason, a model
 * that cannot be reached still leaves the customer with an answer, and the
 * model is swapped for a scripted one in tests.
 *
 * Every way a turn can fail ends in something sent. A customer who writes
 * and hears nothing assumes nobody is there; a fallback reply that hands the
 * conversation to a person is always better than silence.
 */

import type { ConversationState, ToolCallRecord, TurnUsage } from "../ports";
import { FALLBACK_REPLY, HANDOFF_REPLY } from "./guardrails";
import { checkReply } from "./reply";
import { ModelUnavailableError, type ChatModel, type ModelMessage, type ModelToolResult } from "./model";
import { SYSTEM } from "./prompt";
import { runTool, toModelTool, type Tool, type ToolContext } from "../tools/tool";

/** WhatsApp's own ceiling on a message body. */
export const MAX_REPLY = 4096;

export type TurnOutcome = {
  reply: string;
  state: ConversationState;
  handoff: { reason: string; summary: string } | null;
  iterations: number;
  toolCalls: ToolCallRecord[];
  usage: TurnUsage;
  errorCode: string | null;
  /** What the checks in `reply.ts` had to put right, for the run's record. */
  corrections: string[];
};

export async function runAgentTurn(input: {
  model: ChatModel;
  tools: Tool[];
  context: ToolContext;
  history: ModelMessage[];
  contextText: () => string;
  maxIterations: number;
}): Promise<TurnOutcome> {
  const { model, tools, context } = input;
  const modelTools = tools.map(toModelTool);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const messages: ModelMessage[] = [...input.history];
  const toolCalls: ToolCallRecord[] = [];
  const usage: TurnUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

  /**
   * Nothing reaches the customer without the checks in `reply.ts`: a
   * reference must be one that exists, a record made this turn must be
   * named, and a request must not read as a confirmed booking.
   */
  const finish = (reply: string, extra: { errorCode?: string | null; iterations: number }): TurnOutcome => {
    const checked = checkReply(reply, { created: context.createdFor, references: context.state.references });
    return {
      reply: checked.text.length > MAX_REPLY ? `${checked.text.slice(0, MAX_REPLY - 1)}…` : checked.text,
      state: context.state,
      handoff: context.handoff,
      iterations: extra.iterations,
      toolCalls,
      usage,
      errorCode: extra.errorCode ?? null,
      corrections: checked.corrections,
    };
  };

  /** Nothing usable came back: tell the customer, and put a person on it. */
  const giveUp = (errorCode: string, iterations: number) => {
    context.handoff ??= { reason: "cannot_help", summary: `The assistant could not answer (${errorCode}).` };
    return finish(FALLBACK_REPLY, { errorCode, iterations });
  };

  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    let response;
    try {
      response = await model.respond({
        system: SYSTEM,
        // Rebuilt every round: a tool may have just recorded something new.
        context: input.contextText(),
        messages,
        tools: modelTools,
      });
    } catch (error) {
      return giveUp(error instanceof ModelUnavailableError ? error.code : "model_error", iteration);
    }

    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;
    usage.cacheReadTokens += response.usage.cacheReadTokens;

    if (response.stopReason === "refusal") return giveUp("model_refused", iteration);

    if (response.toolCalls.length === 0) {
      if (!response.text) return giveUp("empty_reply", iteration);
      return finish(response.text, { iterations: iteration });
    }

    // A tool input cut off at the token limit can still parse as a valid,
    // shorter object. Running it on half an address would be worse than not.
    if (response.stopReason === "max_tokens") return giveUp("truncated_tool_call", iteration);

    messages.push({ role: "assistant", text: response.text, toolCalls: response.toolCalls, replay: response.replay });

    const results: ModelToolResult[] = [];
    // In order, not in parallel: a later call in the same round may depend
    // on what an earlier one recorded.
    for (const call of response.toolCalls) {
      const started = performance.now();
      const tool = byName.get(call.name);
      const result = tool
        ? await runTool(tool, context, call.input)
        : ({ ok: false, error: { code: "unknown_tool", message: `There is no tool called ${call.name}.` } } as const);
      toolCalls.push({
        name: call.name,
        ok: result.ok,
        errorCode: result.ok ? null : result.error.code,
        durationMs: Math.round(performance.now() - started),
      });
      results.push({ callId: call.id, content: JSON.stringify(result), isError: !result.ok });
    }
    messages.push({ role: "tool_results", results });

    // Handing over ends the turn in words the application chooses, not the
    // model's: the customer is told a person is coming, and nothing else.
    if (context.handoff) return finish(HANDOFF_REPLY, { iterations: iteration });
  }

  return giveUp("iteration_limit", input.maxIterations);
}


