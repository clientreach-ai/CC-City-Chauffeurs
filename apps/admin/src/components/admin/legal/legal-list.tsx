"use client";

import { ExternalLink, Pencil } from "lucide-react";

import { adminRoutes } from "@/components/admin/shell/routes";
import { Tag } from "@/components/admin/ui/badge";
import { ButtonLink } from "@/components/admin/ui/button";
import { ErrorState, LoadingRows, Notice, PageBody, PageHeader, Panel } from "@/components/admin/ui/page";
import { formatDateTime } from "@CC-City-Chauffeurs/core";
import { SITE_URL } from "@/lib/api/client";
import { getLegalDocuments } from "@/lib/api/legal";
import { useCmsQuery } from "@/lib/query";

const WEBSITE_PATH = { privacy: "/privacy", terms: "/terms" } as const;

/** The two legal pages, and whether each is the default wording or an edited version. */
export function LegalList() {
  const { data, loading, error, reload } = useCmsQuery("legal:list", getLegalDocuments);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Website"
        title="Legal pages"
        description="The privacy notice and the terms of service, linked from the footer of every page. Saving a change publishes it on the website straight away."
      />

      <Notice tone="warning" title="Have legal text reviewed before you publish it">
        These pages are relied on by customers and regulators. The wording the site started with is a draft — check
        retention periods, cancellation terms and your ICO registration with a qualified adviser, then update them here.
      </Notice>

      <div className="mt-8">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading || !data ? (
          <LoadingRows rows={2} label="Loading the legal pages" />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {data.map((document) => (
              <Panel key={document.id} title={document.title}>
                <div className="flex flex-col gap-4">
                  <div>
                    <Tag>{document.isDefault ? "Default wording" : "Edited"}</Tag>
                  </div>
                  <p className="text-[0.875rem] leading-relaxed text-white/70">{document.summary}</p>
                  <p className="text-[0.75rem] text-white/55">
                    {document.isDefault
                      ? `${document.sections.length} sections · not edited yet`
                      : `${document.sections.length} sections · last saved ${formatDateTime(document.updatedAt)}${
                          document.updatedBy ? ` by ${document.updatedBy}` : ""
                        }`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink href={adminRoutes.legalDocument(document.id)} size="sm" variant="primary">
                      <Pencil aria-hidden />
                      Edit
                    </ButtonLink>
                    <ButtonLink
                      href={`${SITE_URL}${WEBSITE_PATH[document.id]}`}
                      size="sm"
                      variant="ghost"
                      external
                    >
                      <ExternalLink aria-hidden />
                      View on website
                    </ButtonLink>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}
