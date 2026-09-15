import type { Metadata } from "next";

import { ServiceEditor } from "@/components/admin/services/service-editor";

export const metadata: Metadata = { title: "Edit service" };

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceEditor key={id} id={id} />;
}
