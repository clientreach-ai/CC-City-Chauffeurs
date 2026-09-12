/**
 * Roles — prepared for, not enforced.
 *
 * There is no sign-in yet, so nothing here protects anything: the role is a
 * preview setting that shows how the admin will look to each kind of user.
 * When authentication exists, the server decides the role and enforces these
 * same capabilities on every write; the UI keeps using `can()` to hide what
 * a user may not do.
 */

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
  | "settings.edit";

export const roles: readonly { value: Role; label: string; summary: string }[] = [
  {
    value: "admin",
    label: "Admin",
    summary: "Everything, including site settings.",
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

const grants: Record<Role, readonly Capability[]> = {
  admin: [
    "operations.view",
    "operations.edit",
    "content.edit",
    "content.publish",
    "content.delete",
    "settings.edit",
  ],
  manager: ["operations.view", "operations.edit", "content.edit", "content.publish", "content.delete"],
  editor: ["content.edit"],
};

export function can(role: Role, capability: Capability) {
  return grants[role].includes(capability);
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
    default:
      return "Your role does not include this.";
  }
}
