"use client";

import { usePreferences } from "@/components/admin/shell/preferences";
import { useConfirm } from "@/components/admin/ui/dialog";
import { notify } from "@/components/admin/ui/toast";
import { errorMessage } from "@/lib/query";
import { deniedReason } from "@CC-City-Chauffeurs/core";
import { deleteService, getServiceUsage, setServiceStatus } from "@/lib/api/services";
import type { Service } from "@CC-City-Chauffeurs/core";
import { CmsValidationError } from "@CC-City-Chauffeurs/core";

/** Status changes and deletion for services, shared by the list and editor. */
export function useServiceActions() {
  const confirm = useConfirm();
  const { can } = usePreferences();

  const failed = (title: string, error: unknown) =>
    notify.error(title, error instanceof CmsValidationError ? Object.values(error.fields)[0] : errorMessage(error));

  const change = async (service: Service, status: Service["status"], message: string) => {
    try {
      await setServiceStatus(service.id, status);
      notify.success(message);
      return true;
    } catch (error) {
      failed(`${service.name} was not changed`, error);
      return false;
    }
  };

  return {
    canPublish: can("content.publish"),
    canDelete: can("content.delete"),
    publishReason: deniedReason("content.publish"),
    deleteReason: deniedReason("content.delete"),

    publish: (service: Service) => change(service, "published", `${service.name} published`),

    async unpublish(service: Service) {
      const ok = await confirm({
        title: `Unpublish ${service.name}?`,
        body: `Its page, /chauffeur-services/${service.slug}, comes off the website and it drops out of the navigation and footer. It returns to draft; nothing is deleted.`,
        confirmLabel: "Unpublish",
      });
      return ok ? change(service, "draft", `${service.name} unpublished`) : false;
    },

    async archive(service: Service) {
      const ok = await confirm({
        title: `Archive ${service.name}?`,
        body: "Archived services are kept for reference but have no page on the website — for a service the business no longer offers.",
        confirmLabel: "Archive",
      });
      return ok ? change(service, "archived", `${service.name} archived`) : false;
    },

    restore: (service: Service) => change(service, "draft", `${service.name} restored as a draft`),

    async remove(service: Service) {
      let usage: Awaited<ReturnType<typeof getServiceUsage>> | null = null;
      try {
        usage = await getServiceUsage(service.id);
      } catch {
        usage = null;
      }
      const touches = usage
        ? [
            usage.onHomepage ? "the homepage’s featured services" : "",
            usage.photographs ? `${usage.photographs} gallery photograph${usage.photographs > 1 ? "s" : ""}` : "",
            usage.testimonials ? `${usage.testimonials} testimonial${usage.testimonials > 1 ? "s" : ""}` : "",
          ].filter(Boolean)
        : [];
      const ok = await confirm({
        title: `Delete ${service.name}?`,
        tone: "danger",
        confirmLabel: "Delete permanently",
        body: (
          <>
            <p>This cannot be undone.</p>
            {service.status === "published" ? (
              <p className="mt-3">
                Its page, /chauffeur-services/{service.slug}, will stop existing — links to it from search results
                and elsewhere will break.
              </p>
            ) : null}
            {touches.length ? <p className="mt-3">It will also be unlinked from {touches.join(", ")}.</p> : null}
            <p className="mt-3 text-white/55">To keep a record instead, archive it.</p>
          </>
        ),
      });
      if (!ok) return false;
      try {
        await deleteService(service.id);
        notify.success(`${service.name} deleted`);
        return true;
      } catch (error) {
        failed("Could not delete", error);
        return false;
      }
    },
  };
}

/** Seeded services already have a live page at their original address. */
export function livePath(service: Service) {
  return service.id.startsWith("svc-") ? null : `/chauffeur-services/${service.id}`;
}
