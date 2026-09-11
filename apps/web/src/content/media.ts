/**
 * Image slots for the site.
 *
 * Every file lives in `src/media/` and is statically imported so Next can
 * optimise it and generate a blur placeholder. To swap a photograph, drop a
 * replacement into `src/media/` with the same filename — no component changes
 * required. To point a slot at a different photograph, change it here only.
 *
 * Source: photography from the client's own shoots, taken from their existing
 * site at city-chauffeurs.com. No stock, no fabricated client imagery.
 */
import collectionCanaryWharf from "@/media/collection-canary-wharf.jpg";
import cullinanCanaryWharf from "@/media/cullinan-canary-wharf.jpg";
import cullinanForecourt from "@/media/cullinan-forecourt.jpg";
import cullinanFrontCabin from "@/media/cullinan-front-cabin.jpg";
import cullinanHotelSide from "@/media/cullinan-hotel-side.jpg";
import cullinanO2Front from "@/media/cullinan-o2-front.jpg";
import cullinanPeninsulaNight from "@/media/cullinan-peninsula-night.jpg";
import cullinanRearCabin from "@/media/cullinan-rear-cabin.jpg";
import cullinanWorkshopRear from "@/media/cullinan-workshop-rear.jpg";
import cullinanWorkshopSide from "@/media/cullinan-workshop-side.jpg";
import detailLamborghiniDoor from "@/media/detail-lamborghini-door.jpg";
import detailSpiritOfEcstasy from "@/media/detail-spirit-of-ecstasy.jpg";
import fleetCullinan from "@/media/fleet-cullinan.jpg";
import fleetGWagon from "@/media/fleet-g-wagon.jpg";
import fleetUrus from "@/media/fleet-urus.jpg";
import gWagonSide from "@/media/g-wagon-side.jpg";
import heroCullinanEntrance from "@/media/hero-cullinan-entrance.jpg";
import urusCockpit from "@/media/urus-cockpit.jpg";
import urusSide from "@/media/urus-side.jpg";

/*
 * Only photographs of vehicles on the confirmed fleet are used as
 * representative imagery. The Ferrari SF90 and Rolls-Royce Wraith shoots, and
 * the frames with the SF90 beside the Cullinan, live in the gallery
 * (public/gallery) — `collectionCanaryWharf` is kept for the gallery's own
 * hero, where the copy says plainly that not every car pictured is bookable.
 */
export const media = {
  // Homepage slots
  hero: heroCullinanEntrance,
  statement: detailSpiritOfEcstasy,
  principlesCabin: cullinanRearCabin,
  weddings: cullinanForecourt,

  // Named by subject — used directly on interior pages and in services.ts
  heroCullinanEntrance,
  cullinanPeninsulaNight,
  cullinanCanaryWharf,
  cullinanForecourt,
  cullinanRearCabin,
  cullinanHotelSide,
  cullinanO2Front,
  cullinanWorkshopSide,
  cullinanWorkshopRear,
  cullinanFrontCabin,
  collectionCanaryWharf,
  fleetCullinan,
  fleetGWagon,
  gWagonSide,
  fleetUrus,
  urusSide,
  urusCockpit,
  detailLamborghiniDoor,
} as const;

export type MediaKey = keyof typeof media;
