/**
 * A model that says exactly what it was told to.
 *
 * Tests hand it a script — "call `get_fleet`, then say this" — and it plays
 * the script back one response at a time, recording every request it was
 * sent. That is what lets a test prove the agent looped, fed a tool result
 * back, refused a bad argument, or showed the model the right history,
 * without a network, a key, or a model that answers differently each run.
 *
 * It is also the model the local simulator uses when no key is configured, so
 * the whole pipeline can be exercised on a laptop.
 */

import {
  ModelUnavailableError,
  type ChatModel,
  type ModelRequest,
  type ModelResponse,
  type ModelToolCall,
} from "./model";

export type ScriptStep =
  | { kind: "say"; text: string }
  | { kind: "call"; calls: ModelToolCall[]; text?: string }
  | { kind: "fail"; code: string }
  | { kind: "refuse" };

let callCounter = 0;

/** The model replies with this text and stops. */
export const says = (text: string): ScriptStep => ({ kind: "say", text });

/** The model calls one tool. */
export const calls = (name: string, input: Record<string, unknown> = {}, text?: string): ScriptStep => ({
  kind: "call",
  calls: [{ id: `call_${(callCounter += 1)}`, name, input }],
  text,
});

/** The model calls several tools in one response. */
export const callsMany = (...pairs: [string, Record<string, unknown>][]): ScriptStep => ({
  kind: "call",
  calls: pairs.map(([name, input]) => ({ id: `call_${(callCounter += 1)}`, name, input })),
});

/** The model cannot be reached. */
export const fails = (code = "model_unreachable"): ScriptStep => ({ kind: "fail", code });

/** The model declines the request. */
export const refuses = (): ScriptStep => ({ kind: "refuse" });

export type RecordedRequest = ModelRequest;

export class ScriptedModel implements ChatModel {
  readonly provider = "scripted";
  readonly model = "scripted";
  readonly requests: RecordedRequest[] = [];
  private readonly script: ScriptStep[];

  /** What it says once the script runs out, so a long conversation never throws. */
  static readonly EXHAUSTED = "Thank you — a member of the City Chauffeurs team will be in touch.";

  constructor(script: ScriptStep[] = []) {
    this.script = [...script];
  }

  /** More steps, for a test that talks to the same model across several messages. */
  push(...steps: ScriptStep[]) {
    this.script.push(...steps);
  }

  get remaining() {
    return this.script.length;
  }

  async respond(request: RecordedRequest): Promise<ModelResponse> {
    // A deep copy: the agent keeps appending to its message list, and a test
    // asserting on what the model saw at step two must see step two.
    this.requests.push(structuredClone(request));
    const usage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0 };
    const step = this.script.shift() ?? says(ScriptedModel.EXHAUSTED);

    switch (step.kind) {
      case "say":
        return { text: step.text, toolCalls: [], stopReason: "end_turn", usage };
      case "call":
        return { text: step.text ?? "", toolCalls: step.calls, stopReason: "tool_use", usage };
      case "refuse":
        return { text: "", toolCalls: [], stopReason: "refusal", usage };
      case "fail":
        throw new ModelUnavailableError(step.code, "Scripted failure.");
    }
  }
}
