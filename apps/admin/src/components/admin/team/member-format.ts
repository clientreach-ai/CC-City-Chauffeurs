import { formatRelative, roles, type Role, type TeamMember } from "@CC-City-Chauffeurs/core";

/** "Ama Mensah" → "AM"; one word → its first two letters. */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

export function roleLabel(role: Role) {
  return roles.find((item) => item.value === role)?.label ?? role;
}

/** "in 3 days", "in 5 h", "within the hour". */
function timeUntil(value: string, now: Date) {
  const minutes = Math.round((new Date(value).getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return "within the hour";
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

export function invitationExpired(member: TeamMember, now = new Date()) {
  return (
    member.status === "invited" &&
    !!member.invitationExpiresAt &&
    new Date(member.invitationExpiresAt).getTime() <= now.getTime()
  );
}

/**
 * The "Last active" cell. For someone still invited, what matters is whether
 * their link still works, so that is what it says.
 */
export function activityLine(member: TeamMember, now = new Date()): { text: string; expired?: boolean } {
  if (member.status === "invited") {
    if (!member.invitationExpiresAt) return { text: "Invitation not sent" };
    if (invitationExpired(member, now)) return { text: "Expired — send again", expired: true };
    return { text: `Invitation expires ${timeUntil(member.invitationExpiresAt, now)}` };
  }
  return { text: member.lastActiveAt ? formatRelative(member.lastActiveAt, now) : "Never" };
}
