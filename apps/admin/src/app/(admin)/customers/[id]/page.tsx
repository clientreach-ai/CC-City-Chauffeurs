import type { Metadata } from "next";

import { CustomerDetail } from "@/components/admin/customers/customer-detail";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail key={id} id={id} />;
}
