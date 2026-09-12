import type { Metadata } from "next";

import { Dashboard } from "@/components/admin/dashboard/dashboard";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <Dashboard />;
}
