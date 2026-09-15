import { slugify } from "@CC-City-Chauffeurs/core";
import type {
  FleetCategory,
  FleetCategoryInput,
  PublishStatus,
  Vehicle,
  VehicleFeature,
  VehicleInput,
  Visibility,
} from "@CC-City-Chauffeurs/core";

import { api } from "./client";

/** The rules the form runs as you type; the API runs them again on write. */
export { validateVehicle, validateCategory } from "@CC-City-Chauffeurs/core";

/**
 * Fleet — vehicles, the groupings they appear in, and the feature list.
 *
 * Signatures match what the screens already call. Validation still throws
 * `CmsValidationError`; it is simply raised by the server now, and the same
 * rules run in the form as you type (see `@CC-City-Chauffeurs/core/rules`).
 */

export async function getVehicles() {
  return api.get<Vehicle[]>("/vehicles");
}

export async function getVehicle(id: string) {
  return api.get<Vehicle>(`/vehicles/${id}`);
}

/** A blank vehicle for the "Add vehicle" form. Nothing is pre-filled as fact. */
export function emptyVehicle(): VehicleInput {
  return {
    slug: "",
    name: "",
    make: "",
    model: "",
    categoryIds: [],
    shortDescription: "",
    description: "",
    specs: { passengers: null, luggage: "", year: null, transmission: "", bodyType: "" },
    availability: "chauffeur",
    ownership: "unconfirmed",
    featureIds: [],
    serviceIds: [],
    suitedTags: [],
    pricing: { hourlyRate: null, dayRate: null, airportNote: "", notes: "" },
    images: { main: null, gallery: [] },
    seo: { title: "", description: "", shareImage: null },
    status: "draft",
  };
}

export async function createVehicle(input: VehicleInput) {
  return api.post<Vehicle>("/vehicles", input);
}

export async function updateVehicle(id: string, input: VehicleInput) {
  return api.patch<Vehicle>(`/vehicles/${id}`, input);
}

export async function setVehicleStatus(id: string, status: PublishStatus) {
  return api.patch<Vehicle>(`/vehicles/${id}/status`, { status });
}

export async function duplicateVehicle(id: string) {
  return api.post<Vehicle>(`/vehicles/${id}/duplicate`);
}

export type VehicleUsage = {
  categories: string[];
  services: string[];
  onHomepage: boolean;
  photographs: number;
};

/** What deleting a vehicle would touch — shown in the confirmation. */
export async function getVehicleUsage(id: string) {
  return api.get<VehicleUsage>(`/vehicles/${id}/usage`);
}

export async function deleteVehicle(id: string) {
  return api.delete<void>(`/vehicles/${id}`);
}

export function suggestSlug(name: string) {
  return slugify(name);
}

// ------------------------------------------------------------------ features

export async function getFeatures() {
  return api.get<VehicleFeature[]>("/features");
}

export async function createFeature(label: string, note = "") {
  return api.post<VehicleFeature>("/features", { label, note });
}

// ------------------------------------------------------------------ groupings

export async function getCategories() {
  return api.get<FleetCategory[]>("/fleet-categories");
}

export async function createCategory(input: FleetCategoryInput) {
  return api.post<FleetCategory>("/fleet-categories", input);
}

export async function updateCategory(id: string, input: FleetCategoryInput) {
  return api.patch<FleetCategory>(`/fleet-categories/${id}`, input);
}

export async function setCategoryStatus(id: string, status: Visibility) {
  return api.patch<FleetCategory>(`/fleet-categories/${id}/status`, { status });
}

export async function reorderCategories(ids: string[]) {
  return api.put<void>("/fleet-categories/order", { ids });
}

export async function reorderCategoryVehicles(id: string, vehicleOrder: string[]) {
  return api.put<void>(`/fleet-categories/${id}/vehicles`, { ids: vehicleOrder });
}

export async function deleteCategory(id: string) {
  return api.delete<void>(`/fleet-categories/${id}`);
}
