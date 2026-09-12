"use client";

import { useCmsQuery } from "@/lib/cms/hooks";
import { getEnquiryServices } from "@/lib/cms/repositories/content";
import { getVehicles } from "@/lib/cms/repositories/fleet";

/**
 * Display names for ids stored on operational records — which service an
 * enquiry is for, which vehicle a booking uses. A deleted vehicle keeps its
 * id on old records and reads "no longer listed" rather than disappearing.
 */
export function useLookups() {
  const { data } = useCmsQuery("lookups", async () => {
    const [services, vehicles] = await Promise.all([getEnquiryServices(), getVehicles()]);
    return { services, vehicles: vehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.name })) };
  });

  return {
    ready: data !== undefined,
    services: data?.services ?? [],
    vehicles: data?.vehicles ?? [],
    serviceLabel: (value: string) => data?.services.find((option) => option.value === value)?.label ?? value,
    vehicleName: (id: string | null) => {
      if (!id) return "";
      if (!data) return "";
      return data.vehicles.find((vehicle) => vehicle.id === id)?.name ?? "Vehicle no longer listed";
    },
  };
}
