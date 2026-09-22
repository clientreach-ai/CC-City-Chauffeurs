import type { Metadata } from "next";

import { ConversationList } from "@/components/admin/whatsapp/conversation-list";

export const metadata: Metadata = { title: "WhatsApp" };

export default function WhatsAppPage() {
  return <ConversationList />;
}
