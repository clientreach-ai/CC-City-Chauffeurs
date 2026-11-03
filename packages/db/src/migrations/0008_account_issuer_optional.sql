--
-- The account `issuer` column is better-auth's no longer.
--
-- better-auth 1.7.0 to 1.7.2 added a required `issuer` to every account row
-- and a unique index over it; 1.7.3 took both back out and finds an account by
-- `provider_id` and `account_id` again, as 1.6 did. Its upgrade guide asks for
-- exactly this: the column relaxed and the index dropped, so a row written
-- without it is accepted. The column itself stays until nothing writes it —
-- dropping a column is not undone by a redeploy, and this is.
--
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "account_issuer_accountId_uidx";
