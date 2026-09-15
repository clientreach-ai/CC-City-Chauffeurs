import type { StatementSection } from "@CC-City-Chauffeurs/core";
import { QuietLink, Rule, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

/**
 * The value proposition, said once and briefly. The longer account of the
 * company — the principles in practice, what is included, where we work —
 * lives on the About page.
 */
export function Statement({ index, section }: { index: string; section: StatementSection }) {
  return (
    <section id="chauffeur" className="bg-obsidian text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            {section.label}
          </SectionLabel>
          <p className="label-xs text-white/55">{section.note}</p>
        </div>

        <div className="grid grid-cols-1 gap-10 pt-6 lg:grid-cols-12 lg:items-end lg:gap-16 lg:pt-10">
          <Reveal className="lg:col-span-7">
            <h2 className="display-lg max-w-[20ch] text-white">{section.heading}</h2>
          </Reveal>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal delay={100}>
              <p className="copy-lg max-w-[46ch] text-white/75">{section.body}</p>
            </Reveal>

            <Reveal
              delay={160}
              className="mt-8 flex flex-wrap items-end justify-between gap-6"
            >
              <div>
                <p className="label-xs text-white">{section.signatureName}</p>
                <p className="label-xs mt-2 text-white/55">{section.signatureRole}</p>
              </div>
              {section.link.label ? (
                <QuietLink href={section.link.href}>{section.link.label}</QuietLink>
              ) : null}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
