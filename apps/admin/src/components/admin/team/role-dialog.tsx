"use client";

import { useState } from "react";

import { CmsValidationError, roleWithArticle, type Role, type TeamMember } from "@CC-City-Chauffeurs/core";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { ChoiceCards } from "@/components/admin/ui/form";
import { notify } from "@/components/admin/ui/toast";
import { updateMember } from "@/lib/api/team";
import { errorMessage } from "@/lib/query";

import { roleOptions } from "./invite-dialog";

/** Mounted only while open, so it always starts at the member's current role. */
export function RoleDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [role, setRole] = useState<Role>(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMember(member.id, { role });
      notify.success("Role changed", `${member.name} is now ${roleWithArticle(role)}.`);
      onClose();
    } catch (err) {
      // The API words the refusals people can hit here (the last admin).
      setError(err instanceof CmsValidationError ? (Object.values(err.fields)[0] ?? err.message) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change role"
      description={`What ${member.name} can do in this admin.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={saving} disabled={role === member.role} onClick={() => void save()}>
            Change role
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChoiceCards legend="Role" options={roleOptions} value={role} onChange={setRole} />
        {error ? (
          <p role="alert" className="text-[0.8125rem] leading-snug text-alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
