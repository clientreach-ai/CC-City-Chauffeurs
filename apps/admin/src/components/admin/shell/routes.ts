import type { Route } from "next";

/**
 * Admin routes. This application is the admin, so it owns its own paths —
 * there is no "/admin" prefix any more. `typedRoutes` is on, so paths built
 * from ids are cast once here rather than at every link.
 */
export const adminRoutes = {
  dashboard: "/dashboard" as Route,
  enquiries: "/enquiries" as Route,
  enquiry: (id: string) => `/enquiries/${id}` as Route,
  bookings: "/bookings" as Route,
  bookingsCalendar: "/bookings/calendar" as Route,
  newBooking: "/bookings/new" as Route,
  booking: (id: string) => `/bookings/${id}` as Route,
  customers: "/customers" as Route,
  customer: (id: string) => `/customers/${id}` as Route,
  whatsapp: "/whatsapp" as Route,
  conversation: (id: string) => `/whatsapp/${id}` as Route,
  fleet: "/fleet" as Route,
  newVehicle: "/fleet/new" as Route,
  vehicle: (id: string) => `/fleet/${id}` as Route,
  categories: "/fleet/categories" as Route,
  services: "/services" as Route,
  newService: "/services/new" as Route,
  service: (id: string) => `/services/${id}` as Route,
  gallery: "/gallery" as Route,
  media: "/media" as Route,
  testimonials: "/testimonials" as Route,
  content: "/content" as Route,
  settings: "/settings" as Route,
  signIn: "/sign-in" as Route,
} as const;
