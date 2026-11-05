/**
 * What an imported photograph is, to the seed.
 *
 * The website gets this from Next, which rewrites an image import into an
 * object carrying the file's real dimensions. The seed reads the same files
 * through a Bun plugin that does the same job, so the type has to exist here
 * too or the seed cannot be type-checked at all — which is how a change to
 * the settings contract once reached this package unnoticed.
 */
declare module "*.jpg" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
declare module "*.jpeg" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
declare module "*.png" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
declare module "*.webp" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
declare module "*.avif" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
declare module "*.svg" {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
