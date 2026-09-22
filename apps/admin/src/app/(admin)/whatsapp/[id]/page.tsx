import type { Metadata } from "next";

import { ConversationDetail } from "@/components/admin/whatsapp/conversation-detail";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConversationDetail key={id} id={id} />;
}
