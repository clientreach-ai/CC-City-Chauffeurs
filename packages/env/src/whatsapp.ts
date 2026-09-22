/**
 * Whether the WhatsApp settings make sense together.
 *
 * These settings depend on one another: Twilio cannot verify a webhook
 * without the address it signs, and an assistant cannot think without a key.
 * A half-configured channel must stop the server at boot with a sentence
 * saying what is missing — not start, take a customer's first message, and
 * fail on the reply.
 *
 * A plain function rather than rules buried in the schema, so the rules can
 * be tested against every combination without a process to restart.
 */

/**
 * The model the assistant uses unless `WHATSAPP_AI_MODEL` says otherwise: a
 * capable OpenAI model at a price that suits a few hundred short
 * conversations a month, and one that reads a tool schema reliably.
 */
export const DEFAULT_WHATSAPP_MODEL = "gpt-5.4-mini";

export type WhatsAppSettings = {
  NODE_ENV?: string;
  WHATSAPP_PROVIDER?: "disabled" | "twilio" | "simulator";
  WHATSAPP_WEBHOOK_URL?: string;
  WHATSAPP_NUMBER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  WHATSAPP_SIMULATOR_SECRET?: string;
  WHATSAPP_AI_PROVIDER?: "openai" | "scripted";
  OPENAI_API_KEY?: string;
};

export type ConfigProblem = { path: string; message: string };

export function whatsappConfigProblems(value: WhatsAppSettings): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const missing = (path: string, why: string) => problems.push({ path, message: `${path} is required ${why}.` });

  const provider = value.WHATSAPP_PROVIDER ?? "disabled";
  if (provider === "disabled") return problems;

  const production = value.NODE_ENV === "production";
  const why = `when WHATSAPP_PROVIDER is ${provider}`;

  if (!value.WHATSAPP_NUMBER) missing("WHATSAPP_NUMBER", why);

  if (provider === "twilio") {
    // Twilio signs the address it was given. The simulator signs only the
    // body, so it can do without and falls back to API_URL.
    if (!value.WHATSAPP_WEBHOOK_URL) missing("WHATSAPP_WEBHOOK_URL", why);
    if (!value.TWILIO_ACCOUNT_SID) missing("TWILIO_ACCOUNT_SID", why);
    if (!value.TWILIO_AUTH_TOKEN) missing("TWILIO_AUTH_TOKEN", why);
  }

  if (provider === "simulator") {
    // The simulator is a developer's tool: its wire format is its own, its
    // replies go nowhere, and unsigned it takes a message from anybody who
    // can reach it. Fine on a laptop; never the channel a customer writes to.
    if (production) {
      problems.push({
        path: "WHATSAPP_PROVIDER",
        message: "WHATSAPP_PROVIDER cannot be simulator in production — real customers need twilio.",
      });
    } else if (!value.WHATSAPP_SIMULATOR_SECRET) {
      // Off a laptop it is still reachable, so signing is how it stays ours.
      missing("WHATSAPP_SIMULATOR_SECRET", "to run the simulator anywhere it can be reached");
    }
  }

  if (value.WHATSAPP_AI_PROVIDER === "scripted") {
    // The scripted model answers from a fixed list and hands nothing over. A
    // customer would get the same sentence whatever they wrote.
    if (production) {
      problems.push({
        path: "WHATSAPP_AI_PROVIDER",
        message: "WHATSAPP_AI_PROVIDER cannot be scripted in production — it answers from a fixed script.",
      });
    }
  } else if (!value.OPENAI_API_KEY) {
    missing("OPENAI_API_KEY", "when WHATSAPP_AI_PROVIDER is openai");
  }

  return problems;
}
