import { AdminApp } from "@/components/admin/shell/admin-app";

/**
 * Everything behind a session. The shell reads the session once and holds
 * the screens back until it knows who is asking.
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminApp>{children}</AdminApp>;
}
