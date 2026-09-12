"use client";

import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Eye, EyeOff, Pencil, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";

import { adminRoutes } from "@/components/admin/shell/routes";
import { StatusBadge } from "@/components/admin/ui/badge";
import { ButtonLink } from "@/components/admin/ui/button";
import { useDragSort } from "@/components/admin/ui/drag-sort";
import { Thumb } from "@/components/admin/ui/image";
import { move, ReorderButtons } from "@/components/admin/ui/list-editors";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, PageBody, PageHeader } from "@/components/admin/ui/page";
import { rowLinkClass } from "@/components/admin/ui/table";
import { notify } from "@/components/admin/ui/toast";
import { FilterSelect, ResultCount, SearchField, Toolbar } from "@/components/admin/ui/toolbar";
import { GuardedLink } from "@/components/admin/ui/unsaved";
import { formatRelative } from "@/lib/cms/format";
import { errorMessage, useCmsQuery } from "@/lib/cms/hooks";
import { getVehicles } from "@/lib/cms/repositories/fleet";
import { getServices, reorderServices } from "@/lib/cms/repositories/services";
import { publishStatuses } from "@/lib/cms/status";
import type { PublishStatus, Service } from "@/lib/cms/types";

import { ServicePreview } from "./service-preview";
import { livePath, useServiceActions } from "./use-service-actions";

export function ServiceList() {
  const router = useRouter();
  const actions = useServiceActions();
  const { data, loading, error, reload } = useCmsQuery("services:list", async () => {
    const [services, vehicles] = await Promise.all([getServices(), getVehicles()]);
    return { services, vehicles };
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PublishStatus | "all">("all");
  const [previewing, setPreviewing] = useState<Service | null>(null);

  const services = data?.services ?? [];
  const filtering = query.trim() !== "" || status !== "all";
  const filtered = services.filter((service) => {
    if (status !== "all" && service.status !== status) return false;
    const needle = query.trim().toLowerCase();
    return !needle || service.name.toLowerCase().includes(needle) || service.slug.includes(needle);
  });

  const saveOrder = async (ids: string[]) => {
    try {
      await reorderServices(ids);
      notify.success("Order saved", "Navigation, footer and the services page follow this order.");
    } catch (err) {
      notify.error("Order not saved", errorMessage(err));
    }
  };
  const { itemProps } = useDragSort(
    services.map((service) => service.id),
    (ids) => void saveOrder(ids),
  );

  const menu = (service: Service): MenuAction[] => {
    const live = livePath(service);
    return [
      { label: "Edit", icon: <Pencil />, onSelect: () => router.push(adminRoutes.service(service.id)) },
      { label: "Preview", icon: <Eye />, onSelect: () => setPreviewing(service) },
      ...(live && service.status === "published"
        ? [{ label: "Open the live page", icon: <ExternalLink />, onSelect: () => window.open(live, "_blank", "noopener") } as MenuAction]
        : []),
      "separator",
      service.status === "published"
        ? { label: "Unpublish", icon: <EyeOff />, onSelect: () => void actions.unpublish(service), disabled: !actions.canPublish, reason: actions.publishReason }
        : service.status === "archived"
          ? { label: "Restore as draft", icon: <RotateCcw />, onSelect: () => void actions.restore(service) }
          : { label: "Publish", icon: <Send />, onSelect: () => void actions.publish(service), disabled: !actions.canPublish, reason: actions.publishReason },
      ...(service.status !== "archived"
        ? [{ label: "Archive", icon: <Archive />, onSelect: () => void actions.archive(service), disabled: !actions.canPublish, reason: actions.publishReason } as MenuAction]
        : []),
      "separator",
      { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => void actions.remove(service), disabled: !actions.canDelete, reason: actions.deleteReason },
    ];
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Services"
        description="The chauffeur service pages, in the order the navigation, footer and services page list them. Supercar hire and experiences have pages of their own and are not managed here yet."
        actions={
          <ButtonLink href={adminRoutes.newService} variant="primary">
            <Plus aria-hidden />
            Add service
          </ButtonLink>
        }
      />

      <Toolbar>
        <SearchField label="Search services" value={query} onChange={setQuery} />
        <FilterSelect label="Filter by status" allLabel="Any status" value={status} onChange={setStatus} options={publishStatuses} className="sm:w-40" />
        {data ? <ResultCount count={filtered.length} total={services.length} noun={["service", "services"]} /> : null}
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingRows label="Loading services" />
      ) : !services.length ? (
        <EmptyState
          title="No services yet"
          body="Add the first service page."
          action={
            <ButtonLink href={adminRoutes.newService} variant="primary">
              <Plus aria-hidden />
              Add service
            </ButtonLink>
          }
        />
      ) : !filtered.length ? (
        <EmptyState title="No services match" body="Try a different search or status." />
      ) : (
        <>
          <ol className="border-t border-hairline" aria-label="Services, in display order">
            {filtered.map((service) => {
              const index = services.indexOf(service);
              return (
                <li
                  key={service.id}
                  {...(filtering ? {} : itemProps(service.id))}
                  className={cn(
                    "group relative flex items-center gap-3 border-b border-hairline py-3 transition-colors hover:bg-white/2.5 data-[dragging]:opacity-40 data-[drop-target]:bg-white/5 sm:gap-4",
                    service.status === "archived" ? "opacity-60" : "",
                  )}
                >
                  <span className="label-xs hidden w-7 shrink-0 text-right text-white/45 tabular-nums sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Thumb image={service.heroImage} className="h-12 w-16" />
                  <div className="min-w-0 flex-1">
                    <GuardedLink href={adminRoutes.service(service.id)} className={rowLinkClass}>
                      {service.name}
                    </GuardedLink>
                    <p className="mt-0.5 truncate text-[0.75rem] text-white/50">/chauffeur-services/{service.slug}</p>
                  </div>
                  <span className="hidden text-[0.8125rem] text-white/60 lg:block lg:w-28">
                    {service.vehicleIds.length} {service.vehicleIds.length === 1 ? "vehicle" : "vehicles"}
                  </span>
                  <span className="hidden text-[0.8125rem] text-white/55 xl:block xl:w-28">{formatRelative(service.updatedAt)}</span>
                  <StatusBadge kind="publish" value={service.status} />
                  <div className="relative z-10 flex items-center">
                    {filtering ? null : (
                      <span className="hidden sm:flex">
                        <ReorderButtons
                          index={index}
                          count={services.length}
                          itemLabel={service.name}
                          onMove={(from, to) => void saveOrder(move(services, from, to).map((item) => item.id))}
                        />
                      </span>
                    )}
                    <ActionMenu label={`Actions for ${service.name}`} actions={menu(service)} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-[0.75rem] text-white/50">
            {filtering ? "Clear the search and filter to reorder." : "Drag a row, or use the arrows, to change the order."}
          </p>
        </>
      )}

      {previewing ? (
        <ServicePreview open onClose={() => setPreviewing(null)} service={previewing} vehicles={data?.vehicles ?? []} />
      ) : null}
    </PageBody>
  );
}
