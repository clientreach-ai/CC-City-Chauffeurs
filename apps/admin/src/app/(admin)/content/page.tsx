import type { Metadata } from "next";

import { ContentManager } from "@/components/admin/content/content-manager";

export const metadata: Metadata = { title: "Homepage content" };

export default function ContentPage() {
  return <ContentManager />;
}
