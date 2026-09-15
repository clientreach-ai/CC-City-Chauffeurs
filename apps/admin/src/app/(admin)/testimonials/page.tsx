import type { Metadata } from "next";

import { TestimonialManager } from "@/components/admin/testimonials/testimonial-manager";

export const metadata: Metadata = { title: "Testimonials" };

export default function TestimonialsPage() {
  return <TestimonialManager />;
}
