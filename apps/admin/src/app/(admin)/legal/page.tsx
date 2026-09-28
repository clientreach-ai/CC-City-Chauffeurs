import type { Metadata } from "next";

import { LegalList } from "@/components/admin/legal/legal-list";

export const metadata: Metadata = { title: "Legal pages" };

export default function LegalPage() {
  return <LegalList />;
}
