import type { Metadata } from "next";

import { GalleryManager } from "@/components/admin/gallery/gallery-manager";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return <GalleryManager />;
}
