import {
  assertValid,
  CmsNotFoundError,
  defaultLegalDocuments,
  isLegalDocumentId,
  LEGAL_DOCUMENT_IDS,
  tidyLegalDocument,
  validateLegalDocument,
  type LegalDocument,
  type LegalDocumentContent,
  type LegalDocumentId,
} from "@CC-City-Chauffeurs/core";
import { db, schema } from "@CC-City-Chauffeurs/db";
import { eq } from "drizzle-orm";

import { ConflictError } from "../lib/errors";
import { iso } from "../lib/ids";

/**
 * The privacy notice and the terms of service.
 *
 * A document the editors have saved is served from its row; one they have
 * not — or have reset — is served from the default wording in core. So the
 * website always has a complete page to show, and nothing has to be seeded.
 */

type Row = typeof schema.legalDocument.$inferSelect;

/** Saving before the database has the table: an operator's job, said plainly. */
export class NotMigratedError extends ConflictError {
  constructor() {
    super("Legal pages cannot be saved until the database is updated (migration 0005). Ask whoever deploys the API to run it.");
    this.name = "NotMigratedError";
  }
}

function fromRow(id: LegalDocumentId, row: Row | undefined): LegalDocument {
  if (!row) return { id, ...defaultLegalDocuments[id], updatedAt: null, updatedBy: null, isDefault: true };
  return {
    id,
    title: row.title,
    summary: row.summary,
    sections: row.sections,
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
    isDefault: false,
  };
}

/**
 * The rows, or none while migration 0005 has not been applied to this
 * database. Reading falls back to the default wording rather than failing,
 * so the legal pages keep working if this code reaches a server before its
 * migration does; saving still needs the table, and says so.
 */
async function storedRows(where?: LegalDocumentId): Promise<Row[]> {
  try {
    const query = db.select().from(schema.legalDocument);
    return await (where ? query.where(eq(schema.legalDocument.id, where)).limit(1) : query);
  } catch (error) {
    if (tableMissing(error)) return [];
    throw error;
  }
}

/** Postgres's "undefined_table", however the driver wraps it. */
function tableMissing(error: unknown): boolean {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === "42P01") return true;
  }
  return false;
}

/** The id, or a 404 for anything that is not one of the two documents. */
function known(id: string): LegalDocumentId {
  if (!isLegalDocumentId(id)) throw new CmsNotFoundError("That legal page");
  return id;
}

export async function getLegalDocument(id: string): Promise<LegalDocument> {
  const key = known(id);
  const [row] = await storedRows(key);
  return fromRow(key, row);
}

export async function getLegalDocuments(): Promise<LegalDocument[]> {
  const rows = await storedRows();
  return LEGAL_DOCUMENT_IDS.map((id) => fromRow(id, rows.find((row) => row.id === id)));
}

/** Saves a new version. The rules are the ones the admin form runs as the editor types. */
export async function updateLegalDocument(
  id: string,
  content: LegalDocumentContent,
  author: string,
): Promise<LegalDocument> {
  const key = known(id);
  const tidy = tidyLegalDocument(content);
  assertValid(validateLegalDocument(tidy));
  const values = { ...tidy, updatedBy: author, updatedAt: new Date() };
  try {
    await db
      .insert(schema.legalDocument)
      .values({ id: key, ...values })
      .onConflictDoUpdate({ target: schema.legalDocument.id, set: values });
  } catch (error) {
    if (tableMissing(error)) throw new NotMigratedError();
    throw error;
  }
  return getLegalDocument(key);
}

/** Back to the default wording: the saved version is removed. */
export async function resetLegalDocument(id: string): Promise<LegalDocument> {
  const key = known(id);
  try {
    await db.delete(schema.legalDocument).where(eq(schema.legalDocument.id, key));
  } catch (error) {
    // Nothing saved can exist without the table: the default is already served.
    if (!tableMissing(error)) throw error;
  }
  return getLegalDocument(key);
}
