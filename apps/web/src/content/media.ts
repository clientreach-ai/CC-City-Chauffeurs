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
import collectionO2 from "@/media/collection-o2.jpg";
import cullinanCabinDetail from "@/media/cullinan-cabin-detail.jpg";
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
import detailCullinanSill from "@/media/detail-cullinan-sill.jpg";
import detailSpiritOfEcstasy from "@/media/detail-spirit-of-ecstasy.jpg";
import fleetCullinan from "@/media/fleet-cullinan.jpg";
import fleetGWagon from "@/media/fleet-g-wagon.jpg";
import fleetSf90 from "@/media/fleet-sf90.jpg";
import fleetUrus from "@/media/fleet-urus.jpg";
import gWagonCockpit from "@/media/g-wagon-cockpit.jpg";
import gWagonProfile from "@/media/g-wagon-profile.jpg";
import gWagonSide from "@/media/g-wagon-side.jpg";
import heroCullinanEntrance from "@/media/hero-cullinan-entrance.jpg";
import logoLockupInk from "@/media/logo-lockup-ink.png";
import logoLockup from "@/media/logo-lockup.png";
import logoMark from "@/media/logo-mark.png";
import sf90CanaryWharf from "@/media/sf90-canary-wharf.jpg";
import sf90Cockpit from "@/media/sf90-cockpit.jpg";
import sf90Door from "@/media/sf90-door.jpg";
import sf90HotelNight from "@/media/sf90-hotel-night.jpg";
import urusCockpit from "@/media/urus-cockpit.jpg";
import urusSide from "@/media/urus-side.jpg";
import vClassJetclass from "@/media/v-class-jetclass.jpg";
import wraithBlackBadge from "@/media/wraith-black-badge.jpg";

export const brand = {
  /** Client's logo lockup, keyed off its black background — use on dark. */
  logo: logoLockup,
  /** Same lockup flattened to brand black — use on the light canvas. */
  logoInk: logoLockupInk,
  /** CC monogram alone, for compact placements. */
  logoMark,
} as const;

export const media = {
  // Named by subject — use these directly on interior pages
  heroCullinanEntrance,
  cullinanPeninsulaNight,
  cullinanCanaryWharf,
  cullinanForecourt,
  cullinanRearCabin,
  collectionCanaryWharf,
  sf90HotelNight,

  // Homepage slots
  hero: heroCullinanEntrance,
  statement: detailSpiritOfEcstasy,
  servicesFeature: cullinanPeninsulaNight,
  fleetFeature: fleetCullinan,
  fleetCullinan,
  fleetGWagon,
  fleetSupercar: fleetSf90,
  fleetGroup: vClassJetclass,
  principlesCabin: cullinanRearCabin,
  principlesDetail: detailCullinanSill,
  principlesWheel: cullinanCabinDetail,
  corporate: collectionCanaryWharf,
  corporateAlt: cullinanCanaryWharf,
  weddings: cullinanForecourt,
  selfDrive: sf90HotelNight,
  selfDriveAlt: gWagonProfile,

  // Interior pages
  cullinanHotelSide,
  cullinanO2Front,
  cullinanWorkshopSide,
  cullinanWorkshopRear,
  cullinanFrontCabin,
  collectionO2,
  gWagonSide,
  gWagonCockpit,
  sf90CanaryWharf,
  sf90Cockpit,
  sf90Door,
  fleetUrus,
  urusSide,
  urusCockpit,
  detailLamborghiniDoor,
  wraithBlackBadge,
} as const;

export type MediaKey = keyof typeof media;
