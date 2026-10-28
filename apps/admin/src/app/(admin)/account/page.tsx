import type { Metadata } from "next";

import { AccountPage } from "@/components/admin/account/account-page";

export const metadata: Metadata = { title: "Your account" };

export default function YourAccountPage() {
  return <AccountPage />;
}
