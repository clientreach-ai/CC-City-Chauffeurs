import type { LegalDocument, LegalDocumentContent, LegalDocumentId } from "@CC-City-Chauffeurs/core";

import { api } from "./client";

export { validateLegalDocument } from "@CC-City-Chauffeurs/core";

/**
 * The privacy notice and the terms of service. Saving publishes: the website
 * is told to refresh the page as soon as the API accepts the change.
 */

export async function getLegalDocuments() {
  return api.get<LegalDocument[]>("/legal");
}

export async function getLegalDocument(id: LegalDocumentId) {
  return api.get<LegalDocument>(`/legal/${id}`);
}

export async function updateLegalDocument(id: LegalDocumentId, content: LegalDocumentContent) {
  return api.put<LegalDocument>(`/legal/${id}`, content);
}

/** Discards the saved version and serves the default wording again. */
export async function resetLegalDocument(id: LegalDocumentId) {
  return api.delete<LegalDocument>(`/legal/${id}`);
}
