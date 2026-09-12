"use client";

import { useRouter } from "next/navigation";

import { usePreferences } from "@/components/admin/shell/preferences";
import { adminRoutes } from "@/components/admin/shell/routes";
import { useConfirm } from "@/components/admin/ui/dialog";
import { notify } from "@/components/admin/ui/toast";
import { errorMessage } from "@/lib/cms/hooks";
import { deniedReason } from "@/lib/cms/permissions";
import {
  deleteVehicle,
  duplicateVehicle,
  getVehicleUsage,
  setVehicleStatus,
} from "@/lib/cms/repositories/fleet";
import type { Vehicle } from "@/lib/cms/types";
import { CmsValidationError } from "@/lib/cms/validation";

/**
 * Status changes, duplication and deletion — shared by the fleet list and the
 * vehicle editor so both ask the same questions and say the same things.
 */
export function useVehicleActions() {
  const confirm = useConfirm();
  const router = useRouter();
  const { can } = usePreferences();

  const failed = (title: string, error: unknown) => {
    if (error instanceof CmsValidationError) {
      notify.error(title, Object.values(error.fields)[0] ?? error.message);
    } else {
      notify.error(title, errorMessage(error));
    }
  };

  return {
    canPublish: can("content.publish"),
    canDelete: can("content.delete"),
    publishReason: deniedReason("content.publish"),
    deleteReason: deniedReason("content.delete"),

    async publish(vehicle: Vehicle) {
      try {
        await setVehicleStatus(vehicle.id, "published");
        notify.success(`${vehicle.name} published`, "It is now part of the published fleet.");
        return true;
      } catch (error) {
        failed(`${vehicle.name} was not published`, error);
        return false;
      }
    },

    async unpublish(vehicle: Vehicle) {
      const ok = await confirm({
        title: `Unpublish ${vehicle.name}?`,
        body: "It comes off the fleet page and returns to draft. Nothing is deleted — you can publish it again at any time.",
        confirmLabel: "Unpublish",
      });
      if (!ok) return false;
      try {
        await setVehicleStatus(vehicle.id, "draft");
        notify.success(`${vehicle.name} unpublished`, "Saved as a draft.");
        return true;
      } catch (error) {
        failed("Could not unpublish", error);
        return false;
      }
    },

    async archive(vehicle: Vehicle) {
      const ok = await confirm({
        title: `Archive ${vehicle.name}?`,
        body: "Archived vehicles are kept for reference but never shown on the website — for a car that has left the fleet.",
        confirmLabel: "Archive",
      });
      if (!ok) return false;
      try {
        await setVehicleStatus(vehicle.id, "archived");
        notify.success(`${vehicle.name} archived`);
        return true;
      } catch (error) {
        failed("Could not archive", error);
        return false;
      }
    },

    async restore(vehicle: Vehicle) {
      try {
        await setVehicleStatus(vehicle.id, "draft");
        notify.success(`${vehicle.name} restored as a draft`);
        return true;
      } catch (error) {
        failed("Could not restore", error);
        return false;
      }
    },

    async duplicate(vehicle: Vehicle, open = true) {
      try {
        const copy = await duplicateVehicle(vehicle.id);
        notify.success("Vehicle duplicated", `“${copy.name}” was created as a draft.`);
        if (open) router.push(adminRoutes.vehicle(copy.id));
        return copy;
      } catch (error) {
        failed("Could not duplicate", error);
        return null;
      }
    },

    async remove(vehicle: Vehicle) {
      let usage: Awaited<ReturnType<typeof getVehicleUsage>> | null = null;
      try {
        usage = await getVehicleUsage(vehicle.id);
      } catch {
        usage = null;
      }
      const touches = usage
        ? [
            usage.categories.length ? `the ${usage.categories.join(" and ")} grouping${usage.categories.length > 1 ? "s" : ""}` : "",
            usage.services.length ? `${usage.services.length} service page${usage.services.length > 1 ? "s" : ""}` : "",
            usage.onHomepage ? "the homepage" : "",
            usage.photographs ? `${usage.photographs} gallery photograph${usage.photographs > 1 ? "s" : ""} (kept, unlinked)` : "",
          ].filter(Boolean)
        : [];

      const ok = await confirm({
        title: `Delete ${vehicle.name}?`,
        tone: "danger",
        confirmLabel: "Delete permanently",
        body: (
          <>
            <p>This cannot be undone.</p>
            {touches.length ? (
              <p className="mt-3">
                It will also be removed from {touches.join(", ")}. Past enquiries and bookings keep their record of it.
              </p>
            ) : null}
            <p className="mt-3 text-white/55">To keep a record instead, archive it.</p>
          </>
        ),
      });
      if (!ok) return false;
      try {
        await deleteVehicle(vehicle.id);
        notify.success(`${vehicle.name} deleted`);
        return true;
      } catch (error) {
        failed("Could not delete", error);
        return false;
      }
    },
  };
}
