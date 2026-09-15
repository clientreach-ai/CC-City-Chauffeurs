import type { Metadata } from "next";

import { ServiceList } from "@/components/admin/services/service-list";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return <ServiceList />;
}
