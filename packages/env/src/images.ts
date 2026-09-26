/**
 * The only places a Next app's image optimiser may fetch from.
 *
 * `/_next/image` downloads whatever URL it is handed, re-encodes it and caches
 * the result, so an allow-list of `https://**` turns it into a free image
 * proxy for anyone on the internet — our CPU, our bandwidth, our disk. Each
 * base named here is allowed with everything beneath its path and nothing
 * else: no other host, no other port, no other protocol.
 *
 *   allowImagesFrom("https://media.example.com/city-chauffeurs",
 *                   "https://api.example.com/uploads")
 */
export function allowImagesFrom(...bases: string[]): URL[] {
  return bases.map((base) => new URL(`${base.replace(/\/+$/, "")}/**`));
}
