import { regexes } from "zod/v4/core";

import type { Role } from "./permissions";
import type { ISODateTime } from "./types";
import { validator, type FieldErrors } from "./validation";

/**
 * The team: everyone who can sign in to the admin.
 *
 * Sign-up stays closed. An admin invites someone by name, email and role; the
 * invitation is an email with a single-use link (and the same link, shown
 * once, for the admin to pass on by hand). Opening it lets them choose their
 * own password, which makes the account active. Nobody else ever knows it.
 */

/**
 * `invited`     — asked, has not chosen a password yet. Cannot sign in.
 * `active`      — can sign in.
 * `deactivated` — kept for the history it is attached to, but signed out and
 *                 unable to sign in again until reactivated.
 */
export type MemberStatus = "invited" | "active" | "deactivated";

export const memberStatuses: readonly { value: MemberStatus; label: string; note: string }[] = [
  { value: "active", label: "Active", note: "Can sign in." },
  { value: "invited", label: "Invited", note: "Has not chosen a password yet." },
  { value: "deactivated", label: "Deactivated", note: "Cannot sign in." },
];

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  createdAt: ISODateTime;
  lastActiveAt: ISODateTime | null;
  /** When the current invitation stops working; null unless status is `invited`. */
  invitationExpiresAt: ISODateTime | null;
};

export type InviteMemberInput = { name: string; email: string; role: Role };

/** Any one of these, alone or together. */
export type UpdateMemberInput = {
  role?: Role;
  status?: Extract<MemberStatus, "active" | "deactivated">;
};

/**
 * What the admin gets back when it sends an invitation: the member, the link
 * (shown once — only its hash is stored) and whether the email went out.
 * With mail switched off nothing is sent, so the admin passes the link on.
 */
export type InvitationIssued = {
  member: TeamMember;
  link: string;
  emailed: boolean;
};

/** What an invitation link shows before the password is chosen. */
export type InvitationPreview = { name: string; email: string };

export type AcceptInvitationInput = { token: string; password: string };

export const INVITATION_DAYS = 7;

export const PASSWORD_LENGTH = { min: 12, max: 128 } as const;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_LENGTH.min) return `Use at least ${PASSWORD_LENGTH.min} characters.`;
  if (password.length > PASSWORD_LENGTH.max) return `Use at most ${PASSWORD_LENGTH.max} characters.`;
  return null;
}

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Run by the invite form and by the API.
 *
 * The address is checked a second time, against the rule better-auth's
 * sign-in applies. The general email check lets through addresses such as
 * `jo&ann@example.com` or `user@müller.de`, which sign-in then refuses — so
 * an invitation to one makes an account that can accept and never sign in.
 */
export function validateInvite(input: InviteMemberInput): FieldErrors {
  const errors = validator()
    .required("name", input.name, "Add their name.")
    .maxLength("name", input.name, 120)
    .required("email", input.email, "Add the email address they will sign in with.")
    .maxLength("email", input.email, 160)
    .email("email", input.email)
    .result();
  if (!errors.email && input.email.trim() && !canSignInWith(input.email)) {
    errors.email = "This address can't be used to sign in. Use a plain one, like name@company.co.uk.";
  }
  return errors;
}

/** Whether better-auth will accept this address at sign-in: the `z.email()` it checks with. */
export function canSignInWith(email: string) {
  return regexes.email.test(normaliseEmail(email));
}

/** The signed-in person changing their own password, from their account page. */
export type ChangePasswordInput = { currentPassword: string; newPassword: string; confirmPassword: string };

/**
 * Run by the account page before anything is sent. The server applies the
 * same length rule itself (better-auth, configured with `PASSWORD_LENGTH`)
 * and is what checks the current password.
 */
export function validatePasswordChange(input: ChangePasswordInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.currentPassword) errors.currentPassword = "Enter the password you sign in with now.";
  const weak = passwordProblem(input.newPassword);
  if (weak) errors.newPassword = weak;
  else if (input.currentPassword && input.newPassword === input.currentPassword) {
    errors.newPassword = "Choose a password different from your current one.";
  }
  if (!input.confirmPassword) errors.confirmPassword = "Type the new password again.";
  else if (input.confirmPassword !== input.newPassword) errors.confirmPassword = "The two new passwords do not match.";
  return errors;
}
