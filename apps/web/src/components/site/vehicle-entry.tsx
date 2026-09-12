import Image, { type StaticImageData } from "next/image";

import { GhostLink, Unbroken } from "./primitives";
import { Reveal } from "./reveal";
import { VehiclePlate } from "./vehicle-plate";

/**
 * One vehicle as the fleet page presents it.
 *
 * Presentational only — it takes plain data rather than a fleet record, so
 * the same component renders the live /fleet page and the admin's preview of
 * an unsaved vehicle. What the editor previews is what the site will show.
 */
export type VehicleEntryData = {
  name: string;
  marque: string;
  line: string;
  /** A static import on the site; a plain image reference in the admin. */
  image?: StaticImageData | { src: string; width: number; height: number };
  imageAlt?: string;
  specs: readonly { label: string; value: string }[];
  suited: readonly string[];
  enquireHref: string;
};

export function VehicleEntry({ vehicle, wide }: { vehicle: VehicleEntryData; wide: boolean }) {
  const image = vehicle.image;
  const blur = image && "blurDataURL" in image && image.blurDataURL ? "blur" : "empty";
  const local = image ? image.src.startsWith("data:") : false;

  return (
    <Reveal className="grid grid-cols-1 gap-8 border-t border-hairline pt-10 lg:grid-cols-12 lg:gap-16">
      <div className={wide ? "lg:col-span-7" : "lg:col-span-5"}>
        <div className="media-zoom relative aspect-4/3 w-full overflow-hidden bg-graphite">
          {image ? (
            <Image
              src={image}
              alt={vehicle.imageAlt ?? vehicle.name}
              fill
              quality={85}
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholder={blur}
              unoptimized={local}
              className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:scale-[1.02]"
            />
          ) : (
            <VehiclePlate name={vehicle.name} marque={vehicle.marque} />
          )}
        </div>
      </div>

      <div className={wide ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-6 lg:col-start-7"}>
        <p className="label-xs text-white/55">{vehicle.marque}</p>
        <h3 className="display-md mt-4 text-white">
          <Unbroken text={vehicle.name} />
        </h3>
        <p className="copy mt-5 max-w-[46ch] text-white/60">{vehicle.line}</p>

        <dl className="mt-8">
          {vehicle.specs.map((spec) => (
            <div
              key={spec.label}
              className="flex items-baseline justify-between gap-6 border-b border-hairline py-3.5 first:border-t"
            >
              <dt className="label-xs text-white/55">{spec.label}</dt>
              <dd className="label-xs text-white">{spec.value}</dd>
            </div>
          ))}
        </dl>

        {vehicle.suited.length ? (
          <p className="label-xs mt-6 flex flex-wrap gap-x-4 gap-y-2 text-white/55">
            <span className="text-white/45">Suited to</span>
            {vehicle.suited.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </p>
        ) : null}

        <div className="mt-8">
          <GhostLink href={vehicle.enquireHref} className="!px-6 !py-3">
            Enquire about this vehicle
          </GhostLink>
        </div>
      </div>
    </Reveal>
  );
}
