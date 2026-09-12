import type { Route } from "next";

/**
 * Admin routes. `typedRoutes` is on, so paths built from ids are cast once
 * here rather than at every link.
 */
export const adminRoutes = {
  dashboard: "/admin/dashboard" as Route,
  enquiries: "/admin/enquiries" as Route,
  enquiry: (id: string) => `/admin/enquiries/${id}` as Route,
  bookings: "/admin/bookings" as Route,
  booking: (id: string) => `/admin/bookings/${id}` as Route,
  customers: "/admin/customers" as Route,
  customer: (id: string) => `/admin/customers/${id}` as Route,
  fleet: "/admin/fleet" as Route,
  newVehicle: "/admin/fleet/new" as Route,
  vehicle: (id: string) => `/admin/fleet/${id}` as Route,
  categories: "/admin/fleet/categories" as Route,
  services: "/admin/services" as Route,
  newService: "/admin/services/new" as Route,
  service: (id: string) => `/admin/services/${id}` as Route,
  gallery: "/admin/gallery" as Route,
  testimonials: "/admin/testimonials" as Route,
  content: "/admin/content" as Route,
  settings: "/admin/settings" as Route,
} as const;
