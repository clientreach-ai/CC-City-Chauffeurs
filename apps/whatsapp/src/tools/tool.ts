/**
 * How a tool is defined, shown to the model, and run.
 *
 * Every tool takes a Zod schema for its input. The same schema produces the
 * JSON Schema the model is shown and validates what the model sends back, so
 * the two cannot disagree. Whatever the model produced is untrusted until it
 * has passed that schema; a tool never sees raw model output.
 *
 * Identity never comes from the model. The customer's number, the
 * conversation and the message being answered are in the context the
 * application builds; no tool accepts them as arguments, so no amount of
 * persuasion in a message can make the assistant act for somebody else.
 */

import { z } from "zod";

import type { ModelTool } from "../agent/model";
import type { Catalogue } from "../conversation/journey";
import { BackendValidationError, type Backend, type Conversation, type ConversationState } from "../ports";

export type ToolContext = {
  backend: Backend;
  conversation: Conversation;
  /** Mutable for the length of the turn; saved with its outcome. */
  state: ConversationState;
  /** The published fleet and services, read once per turn and only if needed. */
  catalogue(): Promise<Catalogue>;
  /** The message being answered — what makes a created record idempotent. */
  triggeringMessageId: string;
  /** The name on the customer's record, when there is one. */
  customerName: string | null;
  today: string;
  /** Set by `handoff_to_human`; the channel acts on it once the turn ends. */
  handoff: { reason: string; summary: string } | null;
  /** Set when a record is created, so the channel can link the customer. */
  createdFor: { kind: "enquiry" | "booking"; reference: string } | null;
};

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string } };

export const success = (data: unknown): ToolResult => ({ ok: true, data });
export const failure = (code: string, message: string): ToolResult => ({ ok: false, error: { code, message } });

export type Tool = {
  name: string;
  description: string;
  input: z.ZodType;
  run(context: ToolContext, input: unknown): Promise<ToolResult>;
};

export function defineTool<Schema extends z.ZodType>(definition: {
  name: string;
  description: string;
  input: Schema;
  run(context: ToolContext, input: z.infer<Schema>): Promise<ToolResult>;
}): Tool {
  return definition as Tool;
}

/** The tool as the model is shown it. Closed to properties it does not name. */
export function toModelTool(tool: Tool): ModelTool {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: { ...schema, additionalProperties: false },
  };
}

/**
 * Runs one call the model asked for, and never throws.
 *
 * An argument the schema rejects goes back to the model with the reason, so
 * it can correct itself or ask the customer. A record the server refuses goes
 * back with the server's own message — the same one the website form shows.
 * Anything else becomes a plain "could not be done", never a stack trace: the
 * model repeats what it is told, and the customer should not read one.
 */
export async function runTool(tool: Tool, context: ToolContext, raw: unknown): Promise<ToolResult> {
  const parsed = tool.input.safeParse(raw ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    return failure("invalid_arguments", problems);
  }
  try {
    return await tool.run(context, parsed.data);
  } catch (error) {
    if (error instanceof BackendValidationError) {
      const fields = Object.entries(error.fields)
        .map(([field, message]) => `${field}: ${message}`)
        .join("; ");
      return failure("rejected", fields || error.message);
    }
    return failure("tool_failed", "That could not be done just now.");
  }
}
