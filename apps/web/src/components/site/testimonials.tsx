import type { Testimonial, TestimonialsSection } from "@CC-City-Chauffeurs/core";
import { Rule, SectionLabel, shell } from "@CC-City-Chauffeurs/ui/site/primitives";
import { Reveal } from "@CC-City-Chauffeurs/ui/site/reveal";

/**
 * Real client quotes.
 *
 * Renders nothing until there are published testimonials — and one cannot be
 * published without a first name, a role, a district and a record that the
 * customer agreed to it. Fake reviews are an offence under the Digital
 * Markets, Competition and Consumers Act 2024; the gate is in the admin.
 */
export function Testimonials({
  index,
  section,
  items,
}: {
  index: string;
  section: TestimonialsSection;
  items: Testimonial[];
}) {
  if (items.length === 0) return null;

  return (
    <section id="testimonials" className="bg-obsidian text-white">
      <div className={shell}>
        <Rule tone="dark" />

        <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
          <SectionLabel index={index} tone="dark">
            {section.label}
          </SectionLabel>
          <p className="label-xs text-white/55">{section.note}</p>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-12 pb-24 md:grid-cols-2 lg:grid-cols-3 lg:pb-36">
          {items.map((item, i) => (
            <Reveal
              key={item.id}
              delay={Math.min(i * 80, 320)}
              className="border-t border-hairline pt-7"
            >
              <blockquote className="quote-lg text-white/90">{item.quote}</blockquote>
              <figcaption className="label-xs mt-7 text-white/45">
                <span className="text-white">{item.firstName}</span> · {item.role} ·{" "}
                {item.district}
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
