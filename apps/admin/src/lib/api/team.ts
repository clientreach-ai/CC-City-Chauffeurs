import type { InvitationIssued, InviteMemberInput, TeamMember, UpdateMemberInput } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateInvite } from "@CC-City-Chauffeurs/core";

/** Everyone who can sign in, or has been asked to: active, invited, deactivated. */
export async function getTeam() {
  return api.get<TeamMember[]>("/team");
}

export function emptyInvite(): InviteMemberInput {
  return { name: "", email: "", role: "editor" };
}

/** Creates the member and their invitation. The link comes back once, here. */
export async function inviteMember(input: InviteMemberInput) {
  return api.post<InvitationIssued>("/team", input);
}

/**
 * A role change, or deactivating / reactivating. Reactivating someone who
 * never chose a password puts them back to `invited`, not `active`.
 */
export async function updateMember(id: string, input: UpdateMemberInput) {
  return api.patch<TeamMember>(`/team/${id}`, input);
}

/** A fresh link; the previous one stops working. */
export async function resendInvitation(id: string) {
  return api.post<InvitationIssued>(`/team/${id}/invitation`);
}

/** Removes someone who was invited and has not accepted. */
export async function cancelInvitation(id: string) {
  return api.delete<void>(`/team/${id}`);
}
