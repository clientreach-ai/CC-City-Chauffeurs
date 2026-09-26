import type { Metadata } from "next";

import { EnquiryList } from "@/components/admin/enquiries/enquiry-list";

export const metadata: Metadata = { title: "Enquiries" };

/** Links from the dashboard carry ?status= to open the list already filtered. */
export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  return <EnquiryList initialStatus={typeof status === "string" ? status : undefined} />;
}
