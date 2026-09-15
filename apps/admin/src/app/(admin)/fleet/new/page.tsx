import type { Metadata } from "next";

import { VehicleEditor } from "@/components/admin/fleet/vehicle-editor";

export const metadata: Metadata = { title: "New vehicle" };

export default function NewVehiclePage() {
  return <VehicleEditor />;
}
