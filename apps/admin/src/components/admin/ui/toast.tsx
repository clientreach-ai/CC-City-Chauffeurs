"use client";

import { Toaster, toast } from "sonner";

/**
 * Feedback toasts for the admin, rendered by a toaster of its own so they
 * take the brand treatment and never appear in the public site's toaster.
 */
const TOASTER_ID = "admin";

export const notify = {
  success(message: string, description?: string) {
    toast.success(message, { description, toasterId: TOASTER_ID });
  },
  error(message: string, description?: string) {
    toast.error(message, { description, toasterId: TOASTER_ID, duration: 7000 });
  },
  info(message: string, description?: string) {
    toast(message, { description, toasterId: TOASTER_ID });
  },
};

export function AdminToaster() {
  return (
    <Toaster
      id={TOASTER_ID}
      theme="dark"
      position="bottom-right"
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(92vw,380px)] items-start gap-3 border border-hairline-strong bg-graphite px-4 py-3.5 font-ui text-[0.8125rem] text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
          title: "font-medium leading-snug",
          description: "mt-1 leading-snug text-white/65",
          icon: "mt-0.5 text-silver [&_svg]:size-4",
          error: "border-alert/60 [&_[data-icon]]:text-alert",
        },
      }}
    />
  );
}
