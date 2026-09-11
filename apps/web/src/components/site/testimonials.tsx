import { testimonials } from "@/content/testimonials";
import { Rule, SectionLabel, shell } from "./primitives";
import { Reveal } from "./reveal";

/**
 * Real client quotes.
 *
 * Renders nothing while `content/testimonials.ts` is empty — which it is, and
 * must remain until the client supplies attributable quotes. The band is wired
 * up now so publishing them is a content change rather than a build.
 */
export function Testimonials({ index }: { index: string }) {
  if (testimonials.length === 0) return null;

  return (
    <section id="testimonials" className="bg-obsidian text-white">
      <div className={shell}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            In their words
          </SectionLabel>
          <p className="label-xs text-white/55">Verified clients</p>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-12 pb-24 md:grid-cols-2 lg:grid-cols-3 lg:pb-36">
          {testimonials.map((item, i) => (
            <Reveal
              key={`${item.name}-${item.district}`}
              delay={Math.min(i * 80, 320)}
              className="border-t border-hairline pt-7"
            >
              <blockquote className="quote-lg text-white/90">
                {item.quote}
              </blockquote>
              <figcaption className="label-xs mt-7 text-white/45">
                <span className="text-white">{item.name}</span> · {item.role} ·{" "}
                {item.district}
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
