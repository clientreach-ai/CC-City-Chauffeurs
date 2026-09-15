import { Unbroken } from "./primitives";

/**
 * Stand-in for vehicles the client has not photographed yet. Deliberately
 * typographic rather than a broken image or a stock photograph.
 *
 * In a module of its own (no content imports) so the admin preview can use
 * it without pulling the fleet model into the browser.
 */
export function VehiclePlate({
  name,
  marque,
}: {
  name: string;
  marque: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between border border-hairline bg-graphite p-6">
      <span className="label-xs text-white/50">{marque}</span>
      <span className="display-sm text-white/70">
        <Unbroken text={name} />
      </span>
      <span className="label-xs text-white/45">Photography to follow</span>
    </div>
  );
}
