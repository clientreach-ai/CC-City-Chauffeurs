import { routes, site } from "@/content/site";
import { QuietLink, Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

/**
 * The value proposition, said once and briefly. The longer account of the
 * company — the principles in practice, what is included, where we work —
 * lives on the About page.
 */
export function Statement({ index }: { index: string }) {
  return (
    <section id="chauffeur" className="bg-obsidian text-white">
      <div className={`${shell} pb-20 lg:pb-28`}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            A chauffeur company first
          </SectionLabel>
          <p className="label-xs text-white/55">{site.coverage}</p>
        </div>

        <div className="grid grid-cols-1 gap-10 pt-6 lg:grid-cols-12 lg:items-end lg:gap-16 lg:pt-10">
          <Reveal className="lg:col-span-7">
            <h2 className="display-lg max-w-[20ch] text-white">
              A luxury, discreet way of travelling — without the hassle.
            </h2>
          </Reveal>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal delay={100}>
              <p className="copy-lg max-w-[46ch] text-white/75">
                Discreet, professional chauffeur services for private clients,
                executives, wedding parties and corporate travel — planned around
                comfort, timing and confidentiality. London based, working across the
                United Kingdom and Europe.
              </p>
            </Reveal>

            <Reveal
              delay={160}
              className="mt-8 flex flex-wrap items-end justify-between gap-6"
            >
              <div>
                <p className="label-xs text-white">{site.director}</p>
                <p className="label-xs mt-2 text-white/55">Director, {site.legalName}</p>
              </div>
              <QuietLink href={routes.about}>About the company</QuietLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
