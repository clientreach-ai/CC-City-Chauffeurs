/**
 * In-memory stand-ins for the server's store and backend.
 *
 * Faithful where it matters to the channel: a provider message id is
 * accepted once, a run is claimable once, a conversation with a person gets
 * no run, a closed conversation is never reused. The real Postgres versions
 * are tested in `apps/server`, and the whole pipeline end to end there too;
 * these keep the channel's own logic fast to test and easy to read.
 */

import {
  BackendValidationError,
  acceptsAssistantReplies,
  emptyState,
  type Backend,
  type Conversation,
  type ConversationStatus,
  type ConversationStore,
  type E164,
  type FleetVehicle,
  type InboundMessage,
  type RecordedInbound,
  type RequestCustomer,
  type RequestJourney,
  type ServiceSummary,
  type StoredMessage,
} from "../src/ports";
import { SimulatorProvider } from "../src/providers/simulator";

export const OUR_NUMBER = "+442084433332" as E164;
export const CUSTOMER = "+447700900321" as E164;

type Run = { id: string; conversationId: string; triggeringMessageId: string; status: string; createdAt: Date; record?: unknown };

let clock = Date.UTC(2027, 0, 10, 9, 0, 0);
/** Every stored message a millisecond after the last, so order is exact. */
const tick = () => new Date((clock += 1));

export class MemoryStore implements ConversationStore {
  conversations = new Map<string, Conversation & { handoff: { reason: string; summary: string } | null }>();
  messages: (StoredMessage & { conversationId: string; providerMessageId: string | null; delivery: string })[] = [];
  runs = new Map<string, Run>();
  private seq = 0;
  private id = (prefix: string) => `${prefix}-${(this.seq += 1)}`;

  async recordInbound(message: InboundMessage, customerId: string | null): Promise<RecordedInbound> {
    if (this.messages.some((stored) => stored.providerMessageId === message.providerMessageId)) {
      return { outcome: "duplicate" };
    }
    let conversation = [...this.conversations.values()].find(
      (item) => item.phone === message.from && item.status !== "closed",
    );
    if (!conversation) {
      conversation = {
        id: this.id("wac"),
        phone: message.from,
        customerId,
        profileName: message.profileName,
        status: "ai_active",
        state: emptyState(),
        lastInboundAt: null,
        handoff: null,
      };
      this.conversations.set(conversation.id, conversation);
    }
    conversation.customerId ??= customerId;
    conversation.lastInboundAt = message.receivedAt;

    const stored = {
      id: this.id("wam"),
      conversationId: conversation.id,
      direction: "inbound" as const,
      kind: message.kind,
      author: "customer" as const,
      body: message.text,
      createdAt: tick(),
      providerMessageId: message.providerMessageId,
      delivery: "received",
    };
    this.messages.push(stored);

    let runId: string | null = null;
    if (acceptsAssistantReplies(conversation.status)) {
      runId = this.id("war");
      this.runs.set(runId, { id: runId, conversationId: conversation.id, triggeringMessageId: stored.id, status: "queued", createdAt: tick() });
    }
    return { outcome: "recorded", conversation: structuredClone(conversation), messageId: stored.id, runId };
  }

  async claimRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run || run.status !== "queued") return null;
    run.status = "running";
    return { conversationId: run.conversationId, triggeringMessageId: run.triggeringMessageId };
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error("no such conversation");
    return structuredClone(conversation);
  }

  async history(conversationId: string, limit: number): Promise<StoredMessage[]> {
    return this.messages
      .filter((message) => message.conversationId === conversationId)
      .slice(-limit)
      .map(({ id, direction, kind, author, body, createdAt }) => ({ id, direction, kind, author, body, createdAt }));
  }

  async completeTurn(input: Parameters<ConversationStore["completeTurn"]>[0]) {
    const conversation = this.conversations.get(input.conversationId)!;
    conversation.state = structuredClone(input.state);
    conversation.status = input.status;
    conversation.customerId = input.customerId;
    if (input.handoff) conversation.handoff = input.handoff;
    let replyMessageId: string | null = null;
    if (input.reply !== null) {
      replyMessageId = this.id("wam");
      this.messages.push({
        id: replyMessageId,
        conversationId: input.conversationId,
        direction: "outbound",
        kind: "text",
        author: "assistant",
        body: input.reply,
        createdAt: tick(),
        providerMessageId: null,
        delivery: "pending",
      });
    }
    const run = this.runs.get(input.runId)!;
    run.status = input.run.outcome;
    run.record = input.run;
    return { replyMessageId };
  }

  async markDelivered(messageId: string, providerMessageId: string) {
    const message = this.messages.find((item) => item.id === messageId)!;
    message.delivery = "sent";
    message.providerMessageId = providerMessageId;
  }

  async markUndelivered(messageId: string) {
    this.messages.find((item) => item.id === messageId)!.delivery = "failed";
  }

  async queuedRuns() {
    return [...this.runs.values()].filter((run) => run.status === "queued").map((run) => run.id);
  }

  /** What a restart left behind: runs half-answered, replies never sent. */
  async recoverInterrupted() {
    const requeuedRuns: string[] = [];
    for (const run of this.runs.values()) {
      if (run.status !== "running") continue;
      run.status = "queued";
      requeuedRuns.push(run.id);
    }
    const undelivered = this.messages
      .filter((message) => message.direction === "outbound" && message.delivery === "pending")
      .map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        to: this.conversations.get(message.conversationId)!.phone,
        body: message.body,
      }));
    return { requeuedRuns, undelivered };
  }

  async runsSince(conversationId: string, since: Date) {
    return [...this.runs.values()].filter(
      (run) => run.conversationId === conversationId && run.createdAt >= since,
    ).length;
  }

  async recordOperatorMessage(conversationId: string, body: string) {
    const messageId = this.id("wam");
    this.messages.push({
      id: messageId,
      conversationId,
      direction: "outbound",
      kind: "text",
      author: "operator",
      body,
      createdAt: tick(),
      providerMessageId: null,
      delivery: "pending",
    });
    return { messageId };
  }

  async setStatus(conversationId: string, status: ConversationStatus) {
    const conversation = this.conversations.get(conversationId)!;
    conversation.status = status;
    if (status === "ai_active") conversation.handoff = null;
  }

  /** Test helper: the one conversation, when a test has only one. */
  only() {
    const all = [...this.conversations.values()];
    if (all.length !== 1) throw new Error(`expected one conversation, found ${all.length}`);
    return all[0]!;
  }
}

export const FLEET: FleetVehicle[] = [
  vehicle("veh-cullinan", "cullinan", "Rolls-Royce Cullinan", "Rolls-Royce", "Cullinan", ["Chauffeur fleet", "High-profile SUVs"], 3),
  vehicle("veh-ghost", "ghost", "Rolls-Royce Ghost", "Rolls-Royce", "Ghost", ["Chauffeur fleet"], 3),
  vehicle("veh-sclass", "s-class", "Mercedes S-Class", "Mercedes", "S-Class", ["Chauffeur fleet"], 3),
  vehicle("veh-vclass", "v-class", "Mercedes V-Class", "Mercedes", "V-Class", ["Group transport"], 7),
  vehicle("veh-jet", "v-class-jet", "Mercedes V-Class JetClass", "Mercedes", "V-Class JetClass", ["Group transport"], 4),
  vehicle("veh-bentayga", "bentayga", "Bentley Bentayga", "Bentley", "Bentayga", ["High-profile SUVs"], null),
];

function vehicle(
  id: string,
  slug: string,
  name: string,
  make: string,
  model: string,
  groupings: string[],
  passengers: number | null,
): FleetVehicle {
  return {
    id,
    slug,
    name,
    make,
    model,
    groupings,
    shortDescription: `${name}, chauffeur-driven.`,
    passengers,
    luggage: "",
    chauffeurOnly: true,
    hourlyRate: null,
    dayRate: null,
  };
}

export const SERVICES: ServiceSummary[] = [
  { slug: "airport-transfers", name: "Airport Transfers", summary: "Meet and greet at every London airport." },
  { slug: "weddings", name: "Weddings", summary: "Every timing agreed in advance." },
  { slug: "private-chauffeur", name: "Private Chauffeur", summary: "As directed, by the hour or the day." },
];

type Created = { kind: "enquiry" | "booking"; customer: RequestCustomer; journey: RequestJourney; submissionId: string; reference: string };

export class FakeBackend implements Backend {
  created: Created[] = [];
  customers = new Map<string, { id: string; name: string }>();
  private enquiryNumber = 1100;
  private bookingNumber = 2100;

  async listFleet() {
    return FLEET;
  }
  async listServices() {
    return SERVICES;
  }
  async getService(slug: string) {
    const service = SERVICES.find((item) => item.slug === slug);
    if (!service) return null;
    return { ...service, standfirst: service.summary, benefits: [], needs: ["The date"], vehicleNames: ["Mercedes S-Class"] };
  }

  private record(kind: "enquiry" | "booking", input: { customer: RequestCustomer; journey: RequestJourney; submissionId: string }) {
    const existing = this.created.find((item) => item.submissionId === input.submissionId);
    if (existing) return { reference: existing.reference };
    // The server's own rules, in miniature: the part a test needs to prove
    // the agent cannot get round them.
    if (kind === "booking" && !input.journey.date) throw new BackendValidationError({ date: "Choose the date of the journey." });
    const reference = kind === "enquiry" ? `ENQ-${(this.enquiryNumber += 1)}` : `BKG-${(this.bookingNumber += 1)}`;
    this.created.push({ kind, ...input, reference });
    if (!this.customers.has(input.customer.phone)) {
      this.customers.set(input.customer.phone, { id: `cus-${this.customers.size + 1}`, name: input.customer.name });
    }
    return { reference };
  }

  async createEnquiry(input: { customer: RequestCustomer; journey: RequestJourney; submissionId: string }) {
    return this.record("enquiry", input);
  }
  async createBookingRequest(input: { customer: RequestCustomer; journey: RequestJourney; submissionId: string }) {
    return this.record("booking", input);
  }
  async findEnquiry(reference: string, phone: E164) {
    const found = this.created.find((item) => item.reference === reference && item.customer.phone === phone);
    return found ? { reference, status: "New", createdAt: "2027-01-10T09:00:00.000Z" } : null;
  }
  async matchCustomer(phone: E164) {
    return this.customers.get(phone) ?? null;
  }
}

/** A simulator payload from the customer. */
export function inbound(id: string, text: string, options: { from?: string; type?: string; to?: string } = {}) {
  return JSON.stringify({
    messages: [
      {
        id,
        from: options.from ?? CUSTOMER,
        to: options.to ?? OUR_NUMBER,
        name: "Amelia",
        type: options.type ?? "text",
        text,
      },
    ],
  });
}

export function simulator() {
  return new SimulatorProvider({ ourNumber: OUR_NUMBER });
}
