import type {
  BookingStatus,
  CustomerType,
  EnquirySource,
  EnquiryStatus,
  GalleryCategory,
  LostReason,
  PublishStatus,
  ReplyChannel,
  SocialPlatform,
  VehicleAvailability,
  VehicleOwnership,
  Visibility,
} from "./types";

/**
 * Labels and ordering for every status model, in one place so lists,
 * filters, badges and the dashboard can never disagree about what a status
 * is called or where it sits in the workflow.
 */

export const publishStatuses: readonly { value: PublishStatus; label: string; note: string }[] = [
  { value: "draft", label: "Draft", note: "Not visible on the website" },
  { value: "published", label: "Published", note: "Visible on the website" },
  { value: "archived", label: "Archived", note: "Kept for reference, not visible" },
];

export const visibilityStatuses: readonly { value: Visibility; label: string; note: string }[] = [
  { value: "published", label: "Published", note: "Visible on the website" },
  { value: "draft", label: "Hidden", note: "Not visible on the website" },
];

export const enquiryStatuses: readonly { value: EnquiryStatus; label: string; note: string }[] = [
  { value: "new", label: "New", note: "Not yet answered" },
  { value: "contacted", label: "Contacted", note: "In conversation" },
  { value: "quoted", label: "Quoted", note: "Price given, awaiting a decision" },
  { value: "won", label: "Won", note: "Going ahead" },
  { value: "lost", label: "Lost", note: "Not going ahead" },
];

export const lostReasons: readonly { value: LostReason; label: string }[] = [
  { value: "price", label: "Price" },
  { value: "availability", label: "Availability" },
  { value: "too-slow", label: "Too slow to reply" },
  { value: "no-reply", label: "No reply from customer" },
  { value: "other", label: "Other" },
];

export const enquirySources: readonly { value: EnquirySource; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "referral", label: "Referral" },
];

export const replyChannels: readonly { value: ReplyChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone call" },
  { value: "email", label: "Email" },
];

export const bookingStatuses: readonly { value: BookingStatus; label: string; note: string }[] = [
  { value: "pending", label: "Pending", note: "Awaiting confirmation" },
  { value: "confirmed", label: "Confirmed", note: "Agreed with the customer" },
  { value: "in-progress", label: "In progress", note: "On the road" },
  { value: "completed", label: "Completed", note: "Journey finished" },
  { value: "cancelled", label: "Cancelled", note: "Not going ahead" },
];

export const customerTypes: readonly { value: CustomerType; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "corporate", label: "Corporate" },
  { value: "event", label: "Event" },
];

export const galleryCategories: readonly { value: GalleryCategory; label: string }[] = [
  { value: "vehicles", label: "Vehicles" },
  { value: "weddings", label: "Weddings" },
  { value: "corporate", label: "Corporate" },
  { value: "events", label: "Events" },
  { value: "airport", label: "Airport" },
  { value: "experiences", label: "Experiences" },
];

export const availabilityOptions: readonly { value: VehicleAvailability; label: string }[] = [
  { value: "chauffeur", label: "Chauffeur-driven" },
  { value: "chauffeur-or-self-drive", label: "Chauffeur or self-drive" },
];

export const ownershipOptions: readonly { value: VehicleOwnership; label: string }[] = [
  { value: "unconfirmed", label: "Not yet confirmed" },
  { value: "owned", label: "Owned" },
  { value: "sourced", label: "Sourced from a partner" },
];

export const socialPlatforms: readonly { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
];

export function labelFor<T extends string>(
  list: readonly { value: T; label: string }[],
  value: T | null | undefined,
) {
  if (!value) return "";
  return list.find((item) => item.value === value)?.label ?? value;
}
