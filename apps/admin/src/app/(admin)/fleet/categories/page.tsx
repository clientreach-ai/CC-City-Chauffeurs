import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/fleet/category-manager";

export const metadata: Metadata = { title: "Fleet groupings" };

export default function CategoriesPage() {
  return <CategoryManager />;
}
