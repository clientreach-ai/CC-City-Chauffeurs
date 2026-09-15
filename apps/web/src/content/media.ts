/**
 * Image slots for the site.
 *
 * Every file lives in `public/media/` and is statically imported here so Next
 * can optimise it and generate a blur placeholder for the slots that use one.
 * The same files are served directly at `/media/…`, which is what the database
 * stores for a photograph — so there is one copy, reachable both ways.
 *
 * To swap a photograph, drop a replacement into `public/media/` with the same
 * filename. To point a slot at a different photograph, change it here only.
 *
 * Source: photography from the client's own shoots, taken from their existing
 * site at city-chauffeurs.com. No stock, no fabricated client imagery.
 */
import collectionCanaryWharf from "@/../public/media/collection-canary-wharf.jpg";
import cullinanCanaryWharf from "@/../public/media/cullinan-canary-wharf.jpg";
import cullinanForecourt from "@/../public/media/cullinan-forecourt.jpg";
import cullinanFrontCabin from "@/../public/media/cullinan-front-cabin.jpg";
import cullinanHotelSide from "@/../public/media/cullinan-hotel-side.jpg";
import cullinanO2Front from "@/../public/media/cullinan-o2-front.jpg";
import cullinanPeninsulaNight from "@/../public/media/cullinan-peninsula-night.jpg";
import cullinanRearCabin from "@/../public/media/cullinan-rear-cabin.jpg";
import cullinanWorkshopRear from "@/../public/media/cullinan-workshop-rear.jpg";
import cullinanWorkshopSide from "@/../public/media/cullinan-workshop-side.jpg";
import detailLamborghiniDoor from "@/../public/media/detail-lamborghini-door.jpg";
import detailSpiritOfEcstasy from "@/../public/media/detail-spirit-of-ecstasy.jpg";
import fleetCullinan from "@/../public/media/fleet-cullinan.jpg";
import fleetGWagon from "@/../public/media/fleet-g-wagon.jpg";
import fleetUrus from "@/../public/media/fleet-urus.jpg";
import gWagonSide from "@/../public/media/g-wagon-side.jpg";
import heroCullinanEntrance from "@/../public/media/hero-cullinan-entrance.jpg";
import urusCockpit from "@/../public/media/urus-cockpit.jpg";
import urusSide from "@/../public/media/urus-side.jpg";

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
