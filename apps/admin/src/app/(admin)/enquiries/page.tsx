import type { Metadata } from "next";

import { EnquiryList } from "@/components/admin/enquiries/enquiry-list";

export const metadata: Metadata = { title: "Enquiries" };

export default function EnquiriesPage() {
  return <EnquiryList />;
}
