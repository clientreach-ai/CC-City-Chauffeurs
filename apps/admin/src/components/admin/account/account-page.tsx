"use client";

import { DefinitionList, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { usePreferences } from "@/components/admin/shell/preferences";
import { roles } from "@CC-City-Chauffeurs/core";

import { ChangePasswordForm } from "./change-password-form";

/**
 * The signed-in person's own account: who the admin thinks they are, and the
 * one thing about it they change themselves — their password. Their name,
 * email and role are an admin's to change, from the Team page.
 */
export function AccountPage() {
  const { user, role } = usePreferences();
  const summary = roles.find((option) => option.value === role);

  return (
    <PageBody>
      <PageHeader eyebrow="Account" title="Your account" description="Your sign-in details for this admin." />
      <div className="grid grid-cols-1 gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Change password">
          <ChangePasswordForm email={user?.email ?? ""} />
        </Panel>
        <Panel title="Signed in as" className="self-start">
          <DefinitionList
            items={[
              { label: "Name", value: user?.name },
              { label: "Email", value: user?.email },
              { label: "Role", value: summary?.label ?? role },
            ]}
          />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-white/55">
            To change your name, email address or role, ask an admin — they can do it from the Team page.
          </p>
        </Panel>
      </div>
    </PageBody>
  );
}
