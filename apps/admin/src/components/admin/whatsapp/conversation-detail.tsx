"use client";

import { Bot, CircleX, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { useConfirm } from "@/components/admin/ui/dialog";
import { Field, TextArea } from "@/components/admin/ui/form";
import {
  DefinitionList,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Notice,
  PageBody,
  PageHeader,
  Panel,
} from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";
import { GuardedLink, useUnsavedChanges } from "@/components/admin/ui/unsaved";
import { CmsNotFoundError, CmsValidationError, formatDateTime, formatWhen, labelFor } from "@CC-City-Chauffeurs/core";
import { errorMessage, useCmsQuery } from "@/lib/query";
import {
  conversationStatuses,
  getConversation,
  handoffReasons,
  sendFailureMessage,
  sendReply,
  updateConversationStatus,
  SERVICE_WINDOW_HOURS,
  type ConversationDetail as Conversation,
  type ConversationMessage,
  type ConversationStatus,
} from "@/lib/api/whatsapp";

import { who } from "./conversation-list";

/** WhatsApp's ceiling on one message; the server refuses anything longer. */
const MAX_BODY = 4096;

const authors: Record<ConversationMessage["author"], string> = {
  customer: "Customer",
  assistant: "Assistant",
  operator: "Office",
};

/** What became of an outbound message. Inbound needs no such line. */
function deliveryLine(message: ConversationMessage) {
  switch (message.delivery) {
    case "sent":
      return { text: message.sentAt ? `Delivered ${formatWhen(message.sentAt)}` : "Delivered", failed: false };
    case "pending":
      return { text: "Sending…", failed: false };
    case "failed":
      return { text: message.errorCode ? `Not delivered · ${message.errorCode}` : "Not delivered", failed: true };
    default:
      return null;
  }
}

function Message({ message, name }: { message: ConversationMessage; name: string }) {
  const inbound = message.direction === "inbound";
  const delivery = inbound ? null : deliveryLine(message);

  return (
    <li className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[52ch] min-w-0 border px-4 py-3",
          inbound ? "border-hairline bg-white/2.5" : "border-white/25 bg-white/6",
        )}
      >
        <p className="label-xs text-white/50">
          {message.author === "customer" ? name : authors[message.author]} · {formatWhen(message.createdAt)}
        </p>
        {message.kind === "unsupported" ? (
          <p className="mt-2 text-[0.875rem] leading-relaxed text-white/60">
            <span className="text-white/45">[Attachment — a photograph, voice note or location. It cannot be read here.]</span>
            {message.body ? <span className="mt-1 block break-words text-white/85">{message.body}</span> : null}
          </p>
        ) : (
          <p className="mt-2 text-[0.875rem] leading-relaxed break-words whitespace-pre-line text-white">{message.body}</p>
        )}
        {delivery ? (
          <p className={cn("mt-2 text-[0.75rem]", delivery.failed ? "text-alert" : "text-white/50")}>{delivery.text}</p>
        ) : null}
      </div>
    </li>
  );
}

export function ConversationDetail({ id }: { id: string }) {
  const { can } = usePreferences();
  const confirm = useConfirm();
  const { data: conversation, loading, error, reload } = useCmsQuery(`whatsapp:${id}`, () => getConversation(id));
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | undefined>();
  /** A message recorded but refused by WhatsApp — shown until the next attempt. */
  const [refusal, setRefusal] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [working, setWorking] = useState(false);
  useUnsavedChanges(reply.trim().length > 0);

  const canEdit = can("operations.edit");

  if (error) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "WhatsApp", href: adminRoutes.whatsapp }, { label: "Not found" }]} title="Conversation not found" />
        {error instanceof CmsNotFoundError ? (
          <EmptyState
            icon={<MessageCircle />}
            title="This conversation could not be found"
            body="It may have been removed, or WhatsApp may not be set up on this server."
          />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </PageBody>
    );
  }
  if (loading || !conversation) {
    return (
      <PageBody>
        <PageHeader crumbs={[{ label: "WhatsApp", href: adminRoutes.whatsapp }, { label: "Loading" }]} title="Loading…" />
        <LoadingBlock label="Loading the conversation" />
      </PageBody>
    );
  }

  const name = who(conversation);
  const closed = conversation.status === "closed";
  const note = conversationStatuses.find((option) => option.value === conversation.status)?.note;

  // The same 24-hour rule the server applies, said before the reply is typed
  // rather than after it is refused. The server remains the authority.
  const lastInbound = conversation.lastInboundAt ? new Date(conversation.lastInboundAt).getTime() : 0;
  const outsideWindow = Date.now() - lastInbound > SERVICE_WINDOW_HOURS * 3_600_000;

  const send = async () => {
    setSending(true);
    try {
      const result = await sendReply(conversation.id, reply);
      if (result.sent) {
        setReply("");
        setReplyError(undefined);
        setRefusal(undefined);
        notify.success("Reply sent", "The conversation is now with the office — the assistant will not answer.");
      } else {
        setRefusal(sendFailureMessage(result));
        notify.error("Reply not delivered", sendFailureMessage(result));
      }
      reload();
    } catch (err) {
      if (err instanceof CmsValidationError) setReplyError(err.fields.body);
      else notify.error("Reply not sent", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const move = async (status: ConversationStatus) => {
    if (status === "closed") {
      const ok = await confirm({
        title: `Close the conversation with ${name}?`,
        body: "Nobody answers a closed conversation, and the customer is not told. If they write again, a new conversation opens and the assistant takes it.",
        confirmLabel: "Close conversation",
        cancelLabel: "Keep it open",
        tone: "danger",
      });
      if (!ok) return;
    }
    setWorking(true);
    try {
      await updateConversationStatus(conversation.id, status);
      notify.success(
        status === "ai_active" ? "Handed back to the assistant" : "Conversation closed",
        status === "ai_active" ? "It answers the next message from this customer." : undefined,
      );
      reload();
    } catch (err) {
      notify.error("Status not changed", errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <PageBody>
      <PageHeader
        crumbs={[{ label: "WhatsApp", href: adminRoutes.whatsapp }, { label: name }]}
        title={name}
        meta={
          <>
            <StatusBadge kind="whatsapp" value={conversation.status} />
            <span className="text-[0.8125rem] text-white/60 tabular-nums">{conversation.phone}</span>
            {conversation.lastMessageAt ? (
              <span className="text-[0.8125rem] text-white/60">Last message {formatWhen(conversation.lastMessageAt)}</span>
            ) : null}
          </>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
          <section aria-labelledby="transcript-title">
            <h2 id="transcript-title" className="label-xs mb-4 text-white/70">
              Transcript
            </h2>
            {conversation.messages.length ? (
              <ol className="flex flex-col gap-3">
                {conversation.messages.map((message) => (
                  <Message key={message.id} message={message} name={name} />
                ))}
              </ol>
            ) : (
              <p className="text-[0.875rem] text-white/55">Nothing has been said yet.</p>
            )}
          </section>

          <section aria-labelledby="reply-title">
            <h2 id="reply-title" className="label-xs mb-3 text-white/70">
              Reply <span className="text-white/45">· sent to the customer on WhatsApp</span>
            </h2>

            {closed ? (
              <Notice title="This conversation is closed">
                Nothing can be sent. If the customer writes again, a new conversation opens.
              </Notice>
            ) : (
              <>
                {outsideWindow ? (
                  <Notice tone="warning" title="Outside the 24-hour window" className="mb-4">
                    WhatsApp only allows a reply within {SERVICE_WINDOW_HOURS} hours of the customer&rsquo;s last message.
                    A reply now will be refused — ring or email them instead.
                  </Notice>
                ) : null}
                {refusal ? (
                  <Notice tone="warning" title="The last reply was not delivered" className="mb-4">
                    {refusal} It is kept in the transcript so the office can see what was written.
                  </Notice>
                ) : null}
                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send();
                  }}
                  className="flex flex-col gap-3"
                >
                  <Field
                    label="Your reply"
                    error={replyError}
                    counter={{ value: reply, max: MAX_BODY }}
                    description="Replying takes the conversation from the assistant; it stays with the office until it is handed back."
                  >
                    {(control) => (
                      <TextArea
                        {...control}
                        rows={4}
                        value={reply}
                        disabled={!canEdit}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="e.g. Good morning — the Cullinan is free on Friday. Shall I hold it for you?"
                      />
                    )}
                  </Field>
                  <div>
                    <Button type="submit" variant="primary" size="sm" disabled={!reply.trim() || !canEdit} busy={sending}>
                      <Send aria-hidden />
                      Send reply
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>

        <aside className="order-1 flex flex-col gap-5 lg:order-2" aria-label="Status and details">
          <div className="flex flex-col gap-5 lg:sticky lg:top-18">
            <Panel title="Status">
              <div className="flex items-center gap-3">
                <StatusBadge kind="whatsapp" value={conversation.status} />
                <span className="text-[0.8125rem] text-white/60">{note}</span>
              </div>
              {closed ? null : (
                <div className="mt-5 flex flex-col gap-2">
                  {conversation.status === "ai_active" ? null : (
                    <Button className="w-full" disabled={!canEdit || working} onClick={() => void move("ai_active")}>
                      <Bot aria-hidden />
                      Hand back to the assistant
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full" disabled={!canEdit || working} onClick={() => void move("closed")}>
                    <CircleX aria-hidden />
                    Close conversation
                  </Button>
                </div>
              )}
            </Panel>

            {conversation.handoffReason || conversation.handoffSummary ? (
              <Panel title="Handed over">
                <p className="text-[0.875rem] text-white">{labelFor(handoffReasons, conversation.handoffReason)}</p>
                {conversation.handoffSummary ? (
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-white/70">{conversation.handoffSummary}</p>
                ) : null}
              </Panel>
            ) : null}

            <Panel title="Details">
              <DefinitionList
                className="border-t-0"
                items={[
                  {
                    label: "Customer",
                    value: conversation.customer ? (
                      <GuardedLink href={adminRoutes.customer(conversation.customer.id)} className="underline-offset-4 hover:underline">
                        {conversation.customer.name}
                      </GuardedLink>
                    ) : (
                      <span className="text-white/60">Not linked to a customer record</span>
                    ),
                  },
                  { label: "WhatsApp name", value: conversation.profileName },
                  { label: "Number", value: <span className="tabular-nums">{conversation.phone}</span> },
                  { label: "Started", value: formatDateTime(conversation.createdAt) },
                  {
                    label: "Last inbound",
                    value: conversation.lastInboundAt ? formatDateTime(conversation.lastInboundAt) : "",
                  },
                ]}
              />
            </Panel>
          </div>
        </aside>
      </div>

      {!canEdit ? <Notice className="mt-8">Your role can read conversations but not reply to them or move them.</Notice> : null}
    </PageBody>
  );
}
