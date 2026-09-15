import type { Metadata } from "next";

import { FleetList } from "@/components/admin/fleet/fleet-list";

export const metadata: Metadata = { title: "Fleet" };

export default function FleetPage() {
  return <FleetList />;
}
