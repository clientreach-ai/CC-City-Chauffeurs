import { redirect } from "next/navigation";

import { adminRoutes } from "@/components/admin/shell/routes";

export default function AdminIndex() {
  redirect(adminRoutes.dashboard);
}
