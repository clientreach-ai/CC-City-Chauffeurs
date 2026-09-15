/** A photograph cannot be published without a description. */
import type { GalleryItemInput } from "../types";
import { validator, type FieldErrors } from "../validation";


export function validateGalleryItem(input: GalleryItemInput): FieldErrors {
  return validator()
    .required("image.alt", input.image.alt, "Describe the photograph — it is read aloud to people who cannot see it.")
    .maxLength("image.alt", input.image.alt, 140)
    .maxLength("caption", input.caption, 140)
    .required("row", input.row, "Choose the gallery row this photograph belongs to.")
    .result();
}
