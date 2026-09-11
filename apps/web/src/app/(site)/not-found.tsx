import Image from "next/image";

import { GhostLink, QuietLink, shell } from "@/components/site/primitives";
import { media } from "@/content/media";
import { routes } from "@/content/site";

export default function NotFound() {
  return (
    <section className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian">
      <div className="absolute inset-0">
        <Image
          src={media.cullinanCanaryWharf}
          alt="Rolls-Royce Cullinan at Canary Wharf at night"
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,6,7,0.96)_0%,rgba(6,6,7,0.7)_34%,rgba(6,6,7,0.25)_66%,rgba(6,6,7,0.55)_100%)]"
        />
      </div>

      <div className={`${shell} relative pt-32 pb-16 text-white sm:pb-24`}>
        <p className="label-xs text-silver">404</p>
        <h1 className="display-hero mt-6 max-w-[14ch] text-white">
          Wrong turn
        </h1>
        <p className="copy-lg mt-8 max-w-[42ch] text-white/70">
          That page does not exist. The chauffeur services, the fleet and the
          gallery are all still where you left them.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <GhostLink href={routes.home}>Back to the homepage</GhostLink>
          <QuietLink href={routes.services}>Chauffeur services</QuietLink>
        </div>
      </div>
    </section>
  );
}
