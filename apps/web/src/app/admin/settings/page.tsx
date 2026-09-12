import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsForm />;
}
