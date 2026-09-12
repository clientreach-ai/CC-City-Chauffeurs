import type { Metadata } from "next";

import { VehicleEditor } from "@/components/admin/fleet/vehicle-editor";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed by id so moving between vehicles starts a fresh editor.
  return <VehicleEditor key={id} id={id} />;
}
