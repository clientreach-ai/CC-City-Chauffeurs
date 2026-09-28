import { notFound } from "next/navigation";

import { LegalPage } from "@/components/site/legal-page";
import { pageMetadata } from "@/lib/metadata";
import { getLegalDocument } from "@/lib/site-data";

/** Published every minute from the admin, and at once when an editor saves. */
export const revalidate = 60;

export async function generateMetadata() {
  const document = await getLegalDocument("terms");
  return pageMetadata({
    title: `${document?.title ?? "Terms of Service"} | CC City Chauffeurs`,
    description: document?.summary ?? "",
    path: "/terms",
  });
}

export default async function Page() {
  const document = await getLegalDocument("terms");
  if (!document) notFound();
  return <LegalPage document={document} />;
}
