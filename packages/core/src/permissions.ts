/**
 * Roles — enforced by the API.
 *
 * The role is read off the session, and `requires()` checks it on every write
 * the API accepts. `can()` is here so the admin can avoid offering a control
 * that would only be refused; it is not what does the refusing. A request
 * made outside the admin altogether meets the same check.
 */

import { labelFor } from "./status";

export type Role = "admin" | "manager" | "editor";

export type Capability =
  /** Enquiries, bookings, customers. */
  | "operations.view"
  | "operations.edit"
  /** Create and edit website content, save drafts. */
  | "content.edit"
  /** Make content visible on the website, or take it down. */
  | "content.publish"
  /** Delete content permanently. */
  | "content.delete"
  | "settings.edit"
  /** Invite people to the admin, change their role, deactivate them. */
  | "team.manage";

export const roles: readonly { value: Role; label: string; summary: string }[] = [
  {
    value: "admin",
    label: "Admin",
    summary: "Everything, including site settings and the team.",
  },
  {
    value: "manager",
    label: "Manager",
    summary: "Operations and publishing. No site settings.",
  },
  {
    value: "editor",
    label: "Editor",
    summary: "Website content as drafts. Cannot publish, delete or see operations.",
  },
];

/** The role values alone, for a request body to be checked against. */
export const roleValues = roles.map((role) => role.value) as [Role, ...Role[]];

/** "an Admin", "a Manager", "an Editor" — for a sentence that names a role. */
export function roleWithArticle(role: Role) {
  const label = labelFor(roles, role);
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

const grants: Record<Role, readonly Capability[]> = {
  admin: [
    "operations.view",
    "operations.edit",
    "content.edit",
    "content.publish",
    "content.delete",
    "settings.edit",
    "team.manage",
  ],
  manager: ["operations.view", "operations.edit", "content.edit", "content.publish", "content.delete"],
  editor: ["content.edit"],
};

export function can(role: Role, capability: Capability) {
  // An unrecognised role in the database is refused, not a crash.
  return (grants[role] ?? []).includes(capability);
}

/** The reason shown beside a control the current role cannot use. */
export function deniedReason(capability: Capability) {
  switch (capability) {
    case "content.publish":
      return "Editors save drafts — a manager or admin publishes.";
    case "content.delete":
      return "Only a manager or admin can delete content.";
    case "settings.edit":
      return "Only an admin can change site settings.";
    case "team.manage":
      return "Only an admin can manage the team.";
    default:
      return "Your role does not include this.";
  }
}
