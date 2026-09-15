"use client";

import {
  Archive,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge, Tag } from "@/components/admin/ui/badge";
import { ButtonLink, Button } from "@/components/admin/ui/button";
import { Thumb } from "@/components/admin/ui/image";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { DataTable, rowLinkClass, type Column } from "@/components/admin/ui/table";
import { FilterSelect, ResultCount, SearchField, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatRelative, passengersLine, passengersText, rateLabel } from "@CC-City-Chauffeurs/core";
import { useCmsQuery } from "@/lib/query";
import { getCategories, getVehicles } from "@/lib/api/fleet";
import { publishStatuses } from "@CC-City-Chauffeurs/core";
import type { FleetCategory, PublishStatus, Vehicle } from "@CC-City-Chauffeurs/core";

import { useVehicleActions } from "./use-vehicle-actions";
import { VehiclePreview } from "./vehicle-preview";

export function FleetList() {
  const { data, loading, error, reload } = useCmsQuery("fleet:list", async () => {
    const [vehicles, categories] = await Promise.all([getVehicles(), getCategories()]);
    return { vehicles, categories };
  });
  const actions = useVehicleActions();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | "all">("all");
  const [status, setStatus] = useState<PublishStatus | "all">("all");
  const [previewing, setPreviewing] = useState<Vehicle | null>(null);

  const vehicles = data?.vehicles ?? [];
  const categories = data?.categories ?? [];
  const categoryTitle = new Map(categories.map((item) => [item.id, item.title]));

  const filtered = vehicles.filter((vehicle) => {
    if (category !== "all" && !vehicle.categoryIds.includes(category)) return false;
    if (status !== "all" && vehicle.status !== status) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [vehicle.name, vehicle.make, vehicle.model].some((value) => value.toLowerCase().includes(needle));
  });

  const counts = {
    published: vehicles.filter((v) => v.status === "published").length,
    draft: vehicles.filter((v) => v.status === "draft").length,
    archived: vehicles.filter((v) => v.status === "archived").length,
  };

  const menu = (vehicle: Vehicle): MenuAction[] => [
    { label: "Edit", icon: <Pencil />, onSelect: () => router.push(adminRoutes.vehicle(vehicle.id)) },
    { label: "Preview", icon: <Eye />, onSelect: () => setPreviewing(vehicle) },
    { label: "Duplicate", icon: <Copy />, onSelect: () => void actions.duplicate(vehicle) },
    "separator",
    vehicle.status === "published"
      ? { label: "Unpublish", icon: <EyeOff />, onSelect: () => void actions.unpublish(vehicle), disabled: !actions.canPublish, reason: actions.publishReason }
      : vehicle.status === "archived"
        ? { label: "Restore as draft", icon: <RotateCcw />, onSelect: () => void actions.restore(vehicle) }
        : { label: "Publish", icon: <Send />, onSelect: () => void actions.publish(vehicle), disabled: !actions.canPublish, reason: actions.publishReason },
    ...(vehicle.status !== "archived"
      ? [{ label: "Archive", icon: <Archive />, onSelect: () => void actions.archive(vehicle), disabled: !actions.canPublish, reason: actions.publishReason } as MenuAction]
      : []),
    "separator",
    { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => void actions.remove(vehicle), disabled: !actions.canDelete, reason: actions.deleteReason },
  ];

  const columns: Column<Vehicle>[] = [
    {
      id: "image",
      header: "Photograph",
      hideHeader: true,
      className: "w-22",
      cell: (vehicle) => <Thumb image={vehicle.images.main} className="h-12 w-16" />,
    },
    {
      id: "name",
      header: "Vehicle",
      sortValue: (vehicle) => vehicle.name,
      cell: (vehicle) => (
        <div className="min-w-0">
          <GuardedLink href={adminRoutes.vehicle(vehicle.id)} className={rowLinkClass}>
            {vehicle.name}
          </GuardedLink>
          <p className="mt-0.5 text-[0.75rem] text-white/50">{vehicle.make || "Make not set"}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: "Grouping",
      sortValue: (vehicle) => categoryTitle.get(vehicle.categoryIds[0]) ?? "",
      cell: (vehicle) =>
        vehicle.categoryIds.length ? (
          <div className="flex flex-wrap gap-1.5">
            {vehicle.categoryIds.map((id) => (
              <Tag key={id}>{categoryTitle.get(id) ?? "Unknown"}</Tag>
            ))}
          </div>
        ) : (
          <span className="text-[0.8125rem] text-white/45">None</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (vehicle) => vehicle.status,
      cell: (vehicle) => <StatusBadge kind="publish" value={vehicle.status} />,
    },
    {
      id: "passengers",
      header: "Passengers",
      sortValue: (vehicle) => vehicle.specs.passengers ?? -1,
      cell: (vehicle) => (
        <span className={vehicle.specs.passengers == null ? "text-white/50" : "tabular-nums"}>{passengersText(vehicle)}</span>
      ),
    },
    {
      id: "rate",
      header: "Rate",
      minWidth: "lg",
      sortValue: (vehicle) => vehicle.pricing.hourlyRate ?? -1,
      cell: (vehicle) => (
        <span className={vehicle.pricing.hourlyRate == null ? "text-white/50" : "tabular-nums"}>{rateLabel(vehicle)}</span>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      minWidth: "xl",
      sortValue: (vehicle) => vehicle.updatedAt,
      cell: (vehicle) => <span className="text-white/60">{formatRelative(vehicle.updatedAt)}</span>,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Fleet"
        description="The vehicles on the fleet page, in the client’s four groupings. Drafts and archived vehicles never appear on the website."
        meta={
          data ? (
            <p className="text-[0.8125rem] text-white/60">
              {counts.published} published · {counts.draft} draft{counts.draft === 1 ? "" : "s"}
              {counts.archived ? ` · ${counts.archived} archived` : ""}
            </p>
          ) : null
        }
        actions={
          <>
            <ButtonLink href={adminRoutes.categories}>
              <Layers aria-hidden />
              Groupings
            </ButtonLink>
            <ButtonLink href={adminRoutes.newVehicle} variant="primary">
              <Plus aria-hidden />
              Add vehicle
            </ButtonLink>
          </>
        }
      />

      <Toolbar>
        <SearchField label="Search vehicles" placeholder="Search by name or make" value={query} onChange={setQuery} />
        <FilterSelect
          label="Filter by grouping"
          allLabel="All groupings"
          value={category}
          onChange={setCategory}
          options={categories.map((item: FleetCategory) => ({ value: item.id, label: item.title }))}
        />
        <FilterSelect
          label="Filter by status"
          allLabel="Any status"
          value={status}
          onChange={setStatus}
          options={publishStatuses}
          className="sm:w-40"
        />
        {data ? <ResultCount count={filtered.length} total={vehicles.length} noun={["vehicle", "vehicles"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading the fleet" />
      ) : !vehicles.length ? (
        <EmptyState
          title="No vehicles yet"
          body="Add the first vehicle to start building the fleet page."
          action={
            <ButtonLink href={adminRoutes.newVehicle} variant="primary">
              <Plus aria-hidden />
              Add vehicle
            </ButtonLink>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          title="No vehicles match"
          body="Try a different search, or clear the filters."
          action={
            <Button
              onClick={() => {
                setQuery("");
                setCategory("all");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <DataTable
          caption="Vehicles"
          rows={filtered}
          columns={columns}
          rowKey={(vehicle) => vehicle.id}
          actions={(vehicle) => <ActionMenu label={`Actions for ${vehicle.name}`} actions={menu(vehicle)} />}
          rowClassName={(vehicle) => (vehicle.status === "archived" ? "opacity-60" : "")}
          renderCard={(vehicle) => (
            <div className="flex gap-3">
              <Thumb image={vehicle.images.main} className="h-14 w-18" />
              <div className="min-w-0 flex-1">
                <GuardedLink href={adminRoutes.vehicle(vehicle.id)} className={rowLinkClass}>
                  {vehicle.name}
                </GuardedLink>
                <p className="mt-0.5 text-[0.75rem] text-white/55">
                  {vehicle.categoryIds.map((id) => categoryTitle.get(id)).join(" · ") || "No grouping"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusBadge kind="publish" value={vehicle.status} />
                  <span className="text-[0.75rem] text-white/55">{passengersLine(vehicle)}</span>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {previewing ? (
        <VehiclePreview open onClose={() => setPreviewing(null)} vehicle={previewing} categories={categories} />
      ) : null}
    </PageBody>
  );
}
