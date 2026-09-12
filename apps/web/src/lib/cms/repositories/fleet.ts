import { slugify } from "../format";
import { getDatabase, latency, newId, now, type Tables } from "../store/database";
import type {
  FleetCategory,
  FleetCategoryInput,
  PublishStatus,
  Vehicle,
  VehicleFeature,
  VehicleInput,
  Visibility,
} from "../types";
import { assertValid, CmsNotFoundError, SEO_LIMITS, validator, type FieldErrors } from "../validation";

/**
 * Fleet repository — vehicles, the four groupings, and the feature list.
 *
 * Future API: GET/POST /vehicles, GET/PATCH/DELETE /vehicles/:id,
 * POST /vehicles/:id/duplicate, GET/POST/PATCH /fleet-categories, GET /features.
 */

// ------------------------------------------------------------------ helpers

/** `serviceIds` is stored on the services; attach it on the way out. */
function hydrate(vehicle: Vehicle, tables: Pick<Tables, "services">): Vehicle {
  return {
    ...vehicle,
    serviceIds: tables.services
      .filter((service) => service.vehicleIds.includes(vehicle.id))
      .map((service) => service.id),
  };
}

function uniqueSlug(base: string, taken: Set<string>) {
  let slug = base || "vehicle";
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

/**
 * Rules for saving. A draft needs only a name and a usable slug; publishing
 * needs everything the public fleet page prints.
 */
export function validateVehicle(input: VehicleInput, others: Vehicle[]): FieldErrors {
  const v = validator()
    .required("name", input.name, "Give the vehicle a name.")
    .maxLength("name", input.name, 60)
    .required("slug", input.slug, "A slug is needed for the vehicle's web address.")
    .slug("slug", input.slug)
    .custom("slug", others.some((other) => other.slug === input.slug), "Another vehicle already uses this slug.")
    .maxLength("shortDescription", input.shortDescription, 220)
    .integer("specs.passengers", input.specs.passengers, 1, 60)
    .integer("specs.year", input.specs.year, 1950, new Date().getFullYear() + 1)
    .amount("pricing.hourlyRate", input.pricing.hourlyRate)
    .amount("pricing.dayRate", input.pricing.dayRate)
    .maxLength("seo.title", input.seo.title, SEO_LIMITS.title)
    .maxLength("seo.description", input.seo.description, SEO_LIMITS.description);

  if (input.status === "published") {
    v.required("make", input.make, "Add the make before publishing.")
      .required("shortDescription", input.shortDescription, "Add a short description before publishing.")
      .required("categoryIds", input.categoryIds, "Choose at least one fleet grouping before publishing.")
      .custom(
        "images.main",
        input.images.main != null && !input.images.main.alt.trim(),
        "Describe the main image (alt text) before publishing.",
      );
  }

  return v.result();
}

function syncRelations(draft: Tables, vehicleId: string, categoryIds: string[], serviceIds: string[]) {
  for (const category of draft.fleetCategories) {
    const member = categoryIds.includes(category.id);
    const listed = category.vehicleOrder.includes(vehicleId);
    if (member && !listed) category.vehicleOrder.push(vehicleId);
    if (!member && listed) category.vehicleOrder = category.vehicleOrder.filter((id) => id !== vehicleId);
  }
  for (const service of draft.services) {
    const offered = serviceIds.includes(service.id);
    const listed = service.vehicleIds.includes(vehicleId);
    if (offered && !listed) service.vehicleIds.push(vehicleId);
    if (!offered && listed) service.vehicleIds = service.vehicleIds.filter((id) => id !== vehicleId);
  }
}

// ------------------------------------------------------------------ vehicles

export async function getVehicles(): Promise<Vehicle[]> {
  await latency("read");
  const db = getDatabase();
  const services = db.read("services");
  return db.read("vehicles").map((vehicle) => hydrate(vehicle, { services }));
}

export async function getVehicle(id: string): Promise<Vehicle> {
  await latency("read");
  const db = getDatabase();
  const vehicle = db.read("vehicles").find((item) => item.id === id);
  if (!vehicle) throw new CmsNotFoundError("This vehicle");
  return hydrate(vehicle, { services: db.read("services") });
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

export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  await latency("write");
  const db = getDatabase();
  const existing = db.read("vehicles");
  assertValid(validateVehicle(input, existing));

  const stamp = now();
  const vehicle: Vehicle = {
    ...structuredClone(input),
    id: newId("veh"),
    serviceIds: [],
    createdAt: stamp,
    updatedAt: stamp,
    publishedAt: input.status === "published" ? stamp : null,
  };
  db.write((draft) => {
    draft.vehicles.push(vehicle);
    syncRelations(draft, vehicle.id, input.categoryIds, input.serviceIds);
  });
  return { ...vehicle, serviceIds: input.serviceIds };
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  await latency("write");
  const db = getDatabase();
  const vehicles = db.read("vehicles");
  const current = vehicles.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This vehicle");
  assertValid(validateVehicle(input, vehicles.filter((item) => item.id !== id)));

  const stamp = now();
  const next: Vehicle = {
    ...current,
    ...structuredClone(input),
    id,
    serviceIds: [],
    updatedAt: stamp,
    publishedAt:
      input.status === "published" ? (current.status === "published" ? current.publishedAt : stamp) : current.publishedAt,
  };
  db.write((draft) => {
    draft.vehicles = draft.vehicles.map((item) => (item.id === id ? next : item));
    syncRelations(draft, id, input.categoryIds, input.serviceIds);
  });
  return { ...next, serviceIds: input.serviceIds };
}

export async function setVehicleStatus(id: string, status: PublishStatus): Promise<Vehicle> {
  const current = await getVehicle(id);
  return updateVehicle(id, { ...current, status });
}

export async function duplicateVehicle(id: string): Promise<Vehicle> {
  const source = await getVehicle(id);
  const db = getDatabase();
  const taken = new Set(db.read("vehicles").map((item) => item.slug));
  return createVehicle({
    ...source,
    name: `${source.name} (copy)`,
    slug: uniqueSlug(`${source.slug}-copy`, taken),
    status: "draft",
  });
}

/** What deleting a vehicle would touch — shown in the confirmation. */
export async function getVehicleUsage(id: string) {
  await latency("read");
  const db = getDatabase();
  return {
    categories: db.read("fleetCategories").filter((c) => c.vehicleOrder.includes(id)).map((c) => c.title),
    services: db.read("services").filter((s) => s.vehicleIds.includes(id)).map((s) => s.name),
    onHomepage: db
      .read("homepage")
      .some((section) => section.kind === "fleet" && section.vehicleIds.includes(id)),
    photographs: db.read("gallery").filter((item) => item.vehicleId === id).length,
  };
}

export async function deleteVehicle(id: string): Promise<void> {
  await latency("write");
  const db = getDatabase();
  if (!db.read("vehicles").some((item) => item.id === id)) throw new CmsNotFoundError("This vehicle");
  db.write((draft) => {
    draft.vehicles = draft.vehicles.filter((item) => item.id !== id);
    syncRelations(draft, id, [], []);
    for (const section of draft.homepage) {
      if (section.kind === "fleet") section.vehicleIds = section.vehicleIds.filter((v) => v !== id);
    }
    for (const item of draft.gallery) {
      if (item.vehicleId === id) item.vehicleId = null;
    }
    // Enquiries and bookings keep the id — they are history, and show
    // "vehicle no longer listed" rather than silently changing.
  });
}

export function suggestSlug(name: string) {
  return slugify(name);
}

// ------------------------------------------------------------------ features

export async function getFeatures(): Promise<VehicleFeature[]> {
  await latency("read");
  return getDatabase()
    .read("features")
    .sort((a, b) => a.position - b.position);
}

export async function createFeature(label: string, note = ""): Promise<VehicleFeature> {
  await latency("write");
  assertValid(validator().required("label", label, "Name the feature.").maxLength("label", label, 40).result());
  const db = getDatabase();
  const features = db.read("features");
  const feature: VehicleFeature = {
    id: newId("feat"),
    label: label.trim(),
    note: note.trim(),
    position: features.length,
  };
  db.write((draft) => {
    draft.features.push(feature);
  });
  return feature;
}

// ------------------------------------------------------------------ categories

export async function getCategories(): Promise<FleetCategory[]> {
  await latency("read");
  return getDatabase()
    .read("fleetCategories")
    .sort((a, b) => a.position - b.position);
}

function validateCategory(input: FleetCategoryInput, others: FleetCategory[]) {
  return validator()
    .required("title", input.title, "Name the grouping.")
    .maxLength("title", input.title, 50)
    .required("slug", input.slug)
    .slug("slug", input.slug)
    .custom("slug", others.some((other) => other.slug === input.slug), "Another grouping already uses this slug.")
    .maxLength("summary", input.summary, 160)
    .result();
}

export async function createCategory(input: FleetCategoryInput): Promise<FleetCategory> {
  await latency("write");
  const db = getDatabase();
  const categories = db.read("fleetCategories");
  assertValid(validateCategory(input, categories));
  const stamp = now();
  const category: FleetCategory = {
    ...input,
    id: newId("cat"),
    position: categories.length,
    vehicleOrder: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.write((draft) => {
    draft.fleetCategories.push(category);
  });
  return category;
}

export async function updateCategory(id: string, input: FleetCategoryInput): Promise<FleetCategory> {
  await latency("write");
  const db = getDatabase();
  const categories = db.read("fleetCategories");
  const current = categories.find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This grouping");
  assertValid(validateCategory(input, categories.filter((item) => item.id !== id)));
  const next = { ...current, ...input, updatedAt: now() };
  db.write((draft) => {
    draft.fleetCategories = draft.fleetCategories.map((item) => (item.id === id ? next : item));
  });
  return next;
}

export async function setCategoryStatus(id: string, status: Visibility) {
  const current = (await getCategories()).find((item) => item.id === id);
  if (!current) throw new CmsNotFoundError("This grouping");
  return updateCategory(id, { title: current.title, slug: current.slug, summary: current.summary, status });
}

export async function reorderCategories(ids: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    for (const category of draft.fleetCategories) {
      const position = ids.indexOf(category.id);
      if (position >= 0) category.position = position;
    }
  });
}

export async function reorderCategoryVehicles(id: string, vehicleOrder: string[]): Promise<void> {
  await latency("write");
  getDatabase().write((draft) => {
    const category = draft.fleetCategories.find((item) => item.id === id);
    if (!category) throw new CmsNotFoundError("This grouping");
    // Only reorder — membership is changed from the vehicle editor.
    category.vehicleOrder = vehicleOrder.filter((vehicleId) => category.vehicleOrder.includes(vehicleId));
    category.updatedAt = now();
  });
}

/**
 * Groupings with vehicles in them cannot be deleted: the vehicles would drop
 * off the fleet page without anyone deciding that they should.
 */
export async function deleteCategory(id: string): Promise<void> {
  await latency("write");
  const db = getDatabase();
  const category = db.read("fleetCategories").find((item) => item.id === id);
  if (!category) throw new CmsNotFoundError("This grouping");
  const members = db.read("vehicles").filter((vehicle) => vehicle.categoryIds.includes(id));
  if (members.length) {
    throw new Error(
      `Move ${members.length === 1 ? "its vehicle" : `its ${members.length} vehicles`} to another grouping first.`,
    );
  }
  db.write((draft) => {
    draft.fleetCategories = draft.fleetCategories
      .filter((item) => item.id !== id)
      .sort((a, b) => a.position - b.position)
      .map((item, position) => ({ ...item, position }));
  });
}
