"use client";

import { MessageCircle, RotateCcw } from "lucide-react";
import { useState } from "react";

import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { DataTable, rowLinkClass, type Column } from "@/components/admin/ui/table";
import { ResultCount, SearchField, SegmentedFilter, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { CmsNotFoundError, formatWhen, labelFor } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import {
  conversationStatuses,
  getConversations,
  handoffReasons,
  type ConversationStatus,
  type ConversationSummary,
} from "@/lib/api/whatsapp";

/** What the office calls the person on the other end. */
export function who(conversation: ConversationSummary) {
  return conversation.customer?.name || conversation.profileName || "Unknown number";
}

export function ConversationList() {
  const { data, loading, error, reload } = useCmsQuery("whatsapp:list", () => getConversations(), { refreshMs: 30_000 });
  // Conversations waiting for a person are the reason this screen exists, so
  // that is what it opens on.
  const [status, setStatus] = useState<ConversationStatus | "all">("human_requested");
  const [query, setQuery] = useState("");

  // WhatsApp switched off means the routes are not mounted, so a read 404s.
  // That is a state to explain, not a failure to report.
  if (error instanceof CmsNotFoundError) {
    return (
      <PageBody>
        <PageHeader eyebrow="Operations" title="WhatsApp" />
        <EmptyState
          icon={<MessageCircle />}
          title="WhatsApp is not set up"
          body="This server is running without the WhatsApp channel, so there are no conversations to show. Once the number and the provider are configured, messages appear here."
        />
      </PageBody>
    );
  }

  const conversations = data ?? [];
  const filtered = conversations.filter((conversation) => {
    if (status !== "all" && conversation.status !== status) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [who(conversation), conversation.phone, conversation.lastMessagePreview].some((value) =>
      value.toLowerCase().includes(needle),
    );
  });

  const columns: Column<ConversationSummary>[] = [
    {
      id: "customer",
      header: "Customer",
      sortValue: (conversation) => who(conversation),
      cell: (conversation) => (
        <div className="min-w-0">
          <GuardedLink href={adminRoutes.conversation(conversation.id)} className={rowLinkClass}>
            {who(conversation)}
          </GuardedLink>
          <p className="mt-0.5 text-[0.75rem] text-white/50 tabular-nums">{conversation.phone}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (conversation) => conversationStatuses.findIndex((option) => option.value === conversation.status),
      cell: (conversation) => <StatusBadge kind="whatsapp" value={conversation.status} />,
    },
    {
      id: "reason",
      header: "Handed over",
      minWidth: "lg",
      cell: (conversation) => (
        <span className="text-[0.8125rem] text-white/70">
          {conversation.handoffReason ? labelFor(handoffReasons, conversation.handoffReason) : "—"}
        </span>
      ),
    },
    {
      id: "message",
      header: "Last message",
      minWidth: "xl",
      cell: (conversation) => (
        <span className="line-clamp-2 max-w-[40ch] text-[0.8125rem] text-white/65">
          {conversation.lastMessagePreview || "—"}
        </span>
      ),
    },
    {
      id: "when",
      header: "Last message at",
      sortValue: (conversation) => conversation.lastMessageAt ?? "",
      cell: (conversation) => (
        <span className="text-[0.8125rem] whitespace-nowrap text-white/65">
          {conversation.lastMessageAt ? formatWhen(conversation.lastMessageAt) : "—"}
        </span>
      ),
    },
  ];

  const counts = Object.fromEntries(
    conversationStatuses.map((option) => [option.value, conversations.filter((item) => item.status === option.value).length]),
  );

  return (
    <PageBody>
      <PageHeader
        eyebrow="Operations"
        title="WhatsApp"
        description="Every conversation the assistant is holding, and the ones it has handed to the office. Replying here sends a WhatsApp message to the customer."
        actions={
          <Button size="sm" onClick={reload}>
            <RotateCcw aria-hidden />
            Refresh
          </Button>
        }
      />

      <SegmentedFilter
        label="Status"
        value={status}
        onChange={setStatus}
        className="mt-6 mb-5"
        options={[
          ...conversationStatuses.map((option) => ({ ...option, count: counts[option.value] })),
          { value: "all" as const, label: "All", count: conversations.length },
        ]}
      />

      <Toolbar>
        <SearchField label="Search conversations" placeholder="Name, number, message" value={query} onChange={setQuery} />
        {data ? <ResultCount count={filtered.length} total={conversations.length} noun={["conversation", "conversations"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading conversations" />
      ) : !filtered.length ? (
        <EmptyState
          title={status === "human_requested" && !query ? "Nobody is waiting" : "No conversations match"}
          body={
            status === "human_requested" && !query
              ? "The assistant has not handed anything to the office."
              : "Try another status or search."
          }
        />
      ) : (
        <DataTable
          caption="WhatsApp conversations"
          rows={filtered}
          columns={columns}
          rowKey={(conversation) => conversation.id}
          initialSort={{ id: "when", direction: "desc" }}
          renderCard={(conversation) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <GuardedLink href={adminRoutes.conversation(conversation.id)} className={rowLinkClass}>
                  {who(conversation)}
                </GuardedLink>
                <StatusBadge kind="whatsapp" value={conversation.status} />
              </div>
              <p className="mt-0.5 text-[0.75rem] text-white/50 tabular-nums">{conversation.phone}</p>
              <p className="mt-1.5 line-clamp-2 text-[0.8125rem] text-white/70">{conversation.lastMessagePreview || "—"}</p>
              <p className="mt-1.5 text-[0.75rem] text-white/50">
                {conversation.lastMessageAt ? formatWhen(conversation.lastMessageAt) : "—"}
                {conversation.handoffReason ? ` · ${labelFor(handoffReasons, conversation.handoffReason)}` : ""}
              </p>
            </div>
          )}
        />
      )}
    </PageBody>
  );
}
