--
-- Matching a customer by telephone number, less eagerly.
--
-- The last nine digits was too short a key. A United Kingdom mobile written
-- +441123123123 ends in the same nine digits as one written 07123123123, and
-- so does 123123123 typed on its own — three different people, matched to
-- whichever the database happened to hold. Somebody taking a booking saw the
-- name they had just typed replaced by a stranger's.
--
-- Ten digits is the national number itself: 07700 900123 and +44 7700 900123
-- both end in 7700900123, which is the pair this matching exists to see,
-- while a shorter or differently-prefixed number no longer collides with it.
--
DROP INDEX IF EXISTS "customer_phone_digits_idx";--> statement-breakpoint
CREATE INDEX "customer_phone_digits_idx" ON "customer" (right(regexp_replace("phone", '\D', '', 'g'), 10));
