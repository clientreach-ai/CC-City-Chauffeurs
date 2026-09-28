--
-- The privacy notice and the terms of service, edited in the admin.
--
-- One row per document: "privacy" and "terms". A document with no row is
-- served from the default wording in @CC-City-Chauffeurs/core/legal, so the
-- table starts empty, the website never shows a blank legal page, and
-- deleting a row is how the admin resets a document to its default.
--
CREATE TABLE "legal_document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_document_id_known" CHECK ("id" IN ('privacy', 'terms'))
);
