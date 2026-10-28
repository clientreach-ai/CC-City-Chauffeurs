"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import type { InvitationIssued } from "@CC-City-Chauffeurs/core";

import { Button } from "@/components/admin/ui/button";
import { Dialog } from "@/components/admin/ui/dialog";
import { Field, TextInput } from "@/components/admin/ui/form";
import { Notice } from "@/components/admin/ui/page";
import { notify } from "@/components/admin/ui/toast";

/**
 * The link from a new or re-sent invitation. Only its hash is stored, so this
 * is the one time anybody sees it — when mail is switched off, it is the only
 * way the person gets in.
 */
export function InvitationLinkDialog({ issued, onClose }: { issued: InvitationIssued | null; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
      notify.success("Link copied");
    } catch {
      box.current?.querySelector("input")?.select();
      notify.error("Could not copy the link", "It is selected — copy it yourself.");
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Dialog
      open={issued !== null}
      onClose={close}
      title="Invitation link"
      description={
        issued
          ? issued.emailed
            ? `We've emailed it to ${issued.member.email}. You can also send them this link yourself.`
            : "Email isn't switched on, so nothing was sent — send them this link yourself (WhatsApp, text…)."
          : undefined
      }
      footer={
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      }
    >
      {issued ? (
        <div className="flex flex-col gap-5">
          <Field
            label={`Link for ${issued.member.name}`}
            description="It works once, for this person only, and lets them choose their own password."
          >
            {(control) => (
              <div ref={box} className="flex gap-2">
                <TextInput
                  {...control}
                  readOnly
                  value={issued.link}
                  spellCheck={false}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 font-mono text-[0.8125rem]"
                />
                <Button onClick={() => void copy()} data-autofocus>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            )}
          </Field>
          <Notice>
            This link is shown only once. If it gets lost, use “Send invitation again” — that makes a new link and
            stops this one working.
          </Notice>
        </div>
      ) : null}
    </Dialog>
  );
}
