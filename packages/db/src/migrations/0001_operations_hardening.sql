ALTER TABLE "booking" ADD COLUMN "submission_id" text;--> statement-breakpoint
ALTER TABLE "enquiry" ADD COLUMN "submission_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_submission_idx" ON "booking" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_submission_idx" ON "enquiry" USING btree ("submission_id");--> statement-breakpoint
--
-- References come from Postgres, not from counting rows.
--
-- "SELECT max(reference) + 1" against a UNIQUE column is a race: two people
-- sending the form in the same second read the same maximum and the second
-- insert is refused. A sequence hands out each number exactly once, to
-- whoever asks first, without either transaction waiting on the other.
--
-- The start values sit clear of every reference already issued (ENQ-1049 and
-- BKG-2023 at the time of writing), so the new series can never collide with
-- the old one. The gap is deliberate and harmless: a reference is a label to
-- quote on the phone, not a count of anything.
--
CREATE SEQUENCE IF NOT EXISTS "enquiry_reference_seq" START WITH 1100 INCREMENT BY 1;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "booking_reference_seq" START WITH 2100 INCREMENT BY 1;--> statement-breakpoint
--
-- Matching a returning customer used to read the whole customer table into
-- the API and compare in JavaScript. These two indexes are what let that
-- become a query: the expressions are written exactly as the repository
-- writes them, because an index is only used when it matches to the letter.
--
CREATE INDEX "customer_email_lower_idx" ON "customer" (lower(trim("email")));--> statement-breakpoint
CREATE INDEX "customer_phone_digits_idx" ON "customer" (right(regexp_replace("phone", '\D', '', 'g'), 9));
