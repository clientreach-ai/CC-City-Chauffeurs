import type { Metadata } from "next";

import { LegalEditor } from "@/components/admin/legal/legal-editor";

export const metadata: Metadata = { title: "Edit legal page" };

export default async function LegalDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegalEditor key={id} id={id} />;
}
