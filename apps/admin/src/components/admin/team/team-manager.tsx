"use client";

import { RotateCcw, Send, ShieldCheck, UserMinus, UserPlus, UserX } from "lucide-react";
import { useState } from "react";

import { cn } from "@CC-City-Chauffeurs/ui/lib/utils";
import { deniedReason, roles, type InvitationIssued, type TeamMember } from "@CC-City-Chauffeurs/core";

import { usePreferences } from "@/components/admin/shell/preferences";
import { StatusBadge, Tag } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { useConfirm } from "@/components/admin/ui/dialog";
import { ActionMenu, type MenuAction } from "@/components/admin/ui/menu";
import { EmptyState, ErrorState, LoadingRows, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { DataTable, type Column } from "@/components/admin/ui/table";
import { notify } from "@/components/admin/ui/toast";
import { cancelInvitation, getTeam, resendInvitation, updateMember } from "@/lib/api/team";
import { errorMessage, useCmsQuery } from "@/lib/query";

import { InvitationLinkDialog } from "./invitation-link-dialog";
import { InviteDialog } from "./invite-dialog";
import { activityLine, initials, roleLabel } from "./member-format";
import { RoleDialog } from "./role-dialog";

/**
 * Everyone who can sign in to the admin. An admin invites people, changes
 * their role and deactivates them; everyone else sees the list, so they know
 * who is here and whom to ask. The API refuses the same things this hides.
 */
export function TeamManager() {
  const { can, user } = usePreferences();
  const manage = can("team.manage");
  const confirm = useConfirm();
  const { data, loading, error, reload } = useCmsQuery("team:list", getTeam);
  const [inviting, setInviting] = useState(false);
  const [changingRole, setChangingRole] = useState<TeamMember | null>(null);
  const [issued, setIssued] = useState<InvitationIssued | null>(null);
  /** The member an action is under way for, so a second press waits for the first. */
  const [working, setWorking] = useState<string | null>(null);

  const members = data ?? [];
  const isSelf = (member: TeamMember) => member.id === user?.id;

  const run = async (member: TeamMember, action: () => Promise<void>) => {
    if (working) return;
    setWorking(member.id);
    try {
      await action();
    } finally {
      setWorking(null);
    }
  };

  const resend = (member: TeamMember) =>
    run(member, async () => {
      try {
        setIssued(await resendInvitation(member.id));
      } catch (err) {
        notify.error("Invitation not sent", errorMessage(err));
      }
    });

  const cancel = async (member: TeamMember) => {
    const ok = await confirm({
      title: `Cancel ${member.name}'s invitation?`,
      body: "Their link stops working and they are taken off the team. You can invite them again at any time.",
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
    await run(member, async () => {
      try {
        await cancelInvitation(member.id);
        notify.success("Invitation cancelled", `${member.name}'s link no longer works.`);
      } catch (err) {
        notify.error("Invitation not cancelled", errorMessage(err));
      }
    });
  };

  const deactivate = async (member: TeamMember) => {
    const ok = await confirm({
      title: `Deactivate ${member.name}?`,
      body: "They are signed out at once and can no longer sign in. Their name stays on the notes and history they are part of.",
      confirmLabel: "Deactivate",
      tone: "danger",
    });
    if (!ok) return;
    await run(member, async () => {
      try {
        await updateMember(member.id, { status: "deactivated" });
        notify.success(`${member.name} deactivated`, "They can be reactivated later.");
      } catch (err) {
        notify.error("Not deactivated", errorMessage(err));
      }
    });
  };

  const reactivate = async (member: TeamMember) => {
    let updated: TeamMember;
    try {
      setWorking(member.id);
      updated = await updateMember(member.id, { status: "active" });
    } catch (err) {
      notify.error("Not reactivated", errorMessage(err));
      return;
    } finally {
      setWorking(null);
    }
    if (updated.status === "active") {
      notify.success(`${member.name} can sign in again`);
      return;
    }
    // They never chose a password, so there is nothing to sign in with yet.
    const send = await confirm({
      title: `${member.name} still needs a password`,
      body: "They never accepted their invitation, so they are back on the team as invited. Send them a new invitation so they can choose a password?",
      confirmLabel: "Send invitation",
      cancelLabel: "Not now",
    });
    if (send) await resend(updated);
  };

  const menu = (member: TeamMember): MenuAction[] => {
    const changeRole: MenuAction = { label: "Change role", icon: <ShieldCheck />, onSelect: () => setChangingRole(member) };
    switch (member.status) {
      case "active":
        return [
          changeRole,
          "separator",
          {
            label: "Deactivate",
            icon: <UserX />,
            tone: "danger",
            onSelect: () => void deactivate(member),
            disabled: isSelf(member),
            reason: "You can't deactivate your own account.",
          },
        ];
      case "invited":
        return [
          changeRole,
          { label: "Send invitation again", icon: <Send />, onSelect: () => void resend(member) },
          "separator",
          { label: "Cancel invitation", icon: <UserMinus />, tone: "danger", onSelect: () => void cancel(member) },
        ];
      case "deactivated":
        return [{ label: "Reactivate", icon: <RotateCcw />, onSelect: () => void reactivate(member) }];
    }
  };

  const nameBlock = (member: TeamMember) => (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center border border-white/15 bg-obsidian text-[0.6875rem] font-medium tracking-[0.08em] text-white/80"
      >
        {initials(member.name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-white">
          {member.name}
          {isSelf(member) ? <span className="label-xs ml-2 font-normal text-white/50">You</span> : null}
        </p>
        <p className="truncate text-[0.75rem] text-white/55">{member.email}</p>
      </div>
    </div>
  );

  const activity = (member: TeamMember) => {
    const line = activityLine(member);
    return <span className={cn("text-[0.8125rem]", line.expired ? "text-alert" : "text-white/60")}>{line.text}</span>;
  };

  const columns: Column<TeamMember>[] = [
    { id: "name", header: "Name", cell: nameBlock },
    { id: "role", header: "Role", cell: (member) => <Tag>{roleLabel(member.role)}</Tag> },
    { id: "status", header: "Status", cell: (member) => <StatusBadge kind="member" value={member.status} /> },
    { id: "activity", header: "Last active", cell: activity },
  ];

  const inviteButton = manage ? (
    <Button variant="primary" onClick={() => setInviting(true)}>
      <UserPlus aria-hidden />
      Invite someone
    </Button>
  ) : null;

  return (
    <PageBody>
      <PageHeader
        eyebrow="System"
        title="Team"
        description="Everyone who can sign in to this admin."
        actions={inviteButton}
      />

      {!manage ? (
        <Notice className="mb-6">
          {deniedReason("team.manage")} Ask an admin to invite someone, change a role or deactivate an account.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {error ? (
            <ErrorState error={error} onRetry={reload} title="The team could not be loaded" />
          ) : loading ? (
            <LoadingRows rows={3} label="Loading the team" />
          ) : !members.length ? (
            <EmptyState
              icon={<UserPlus />}
              title="No one here yet"
              body="Invite the people who run the business. Each gets their own sign-in, so notes and changes show who made them."
              action={inviteButton}
            />
          ) : (
            <DataTable
              caption="Team members"
              rows={members}
              columns={columns}
              rowKey={(member) => member.id}
              rowClassName={(member) =>
                cn(
                  member.status === "deactivated" ? "[&>td:not(:last-child)]:opacity-55" : "",
                  working === member.id ? "animate-pulse motion-reduce:animate-none" : "",
                )
              }
              actions={manage ? (member) => <ActionMenu label={`Actions for ${member.name}`} actions={menu(member)} /> : undefined}
              renderCard={(member) => (
                <div className={cn("min-w-0", member.status === "deactivated" ? "opacity-55" : "")}>
                  {nameBlock(member)}
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
                    <Tag>{roleLabel(member.role)}</Tag>
                    <StatusBadge kind="member" value={member.status} />
                  </div>
                  <p className="mt-2 pl-12">{activity(member)}</p>
                </div>
              )}
            />
          )}
        </div>

        <Panel title="What each role can do" className="self-start">
          <ul className="flex flex-col gap-4">
            {roles.map((role) => (
              <li key={role.value}>
                <p className="text-[0.875rem] font-medium text-white">{role.label}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-white/60">{role.summary}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-hairline pt-4 text-[0.75rem] leading-relaxed text-white/50">
            Everyone signs in with their own email address. Don&rsquo;t share a login — notes and changes are recorded
            under the person who made them.
          </p>
        </Panel>
      </div>

      {inviting ? (
        <InviteDialog
          onClose={() => setInviting(false)}
          onIssued={(result) => {
            setInviting(false);
            setIssued(result);
          }}
        />
      ) : null}
      {changingRole ? <RoleDialog member={changingRole} onClose={() => setChangingRole(null)} /> : null}
      <InvitationLinkDialog issued={issued} onClose={() => setIssued(null)} />
    </PageBody>
  );
}
