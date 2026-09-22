/**
 * The City Chauffeurs WhatsApp channel.
 *
 * A library, not a service: `apps/server` mounts it, implements its storage
 * and backend ports with the repositories it already has, and receives the
 * webhook on the existing API. See `ports.ts` for the seams and `channel.ts`
 * for how a message becomes a reply.
 */

export * from "./ports";
export * from "./channel-types";
export { createWhatsAppChannel, londonToday } from "./channel";
export { normalisePhone, tryNormalisePhone, stripWhatsAppPrefix, InvalidPhoneNumberError } from "./phone";
export * from "./providers/index";
export type { ChatModel, ModelMessage, ModelRequest, ModelResponse, ModelTool } from "./agent/model";
export { ModelUnavailableError } from "./agent/model";
export { OpenAIModel, DEFAULT_MODEL, type OpenAIModelOptions, type OpenAIEffort } from "./agent/openai";
export { ScriptedModel, says, calls, callsMany, fails, refuses, type ScriptStep } from "./agent/scripted";
export { cityChauffeursTools } from "./tools/city-chauffeurs";
