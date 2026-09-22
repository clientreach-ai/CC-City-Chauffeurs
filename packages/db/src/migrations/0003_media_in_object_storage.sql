--
-- Photographs live in object storage now.
--
-- A media record has always kept the address a photograph is served from.
-- It now keeps the key the file is stored under as well, so that replacing
-- or deleting the record can replace or delete the file in the bucket. A
-- null key is an address this API does not manage — nothing is deleted
-- behind it.
--
ALTER TABLE "media_asset" ADD COLUMN "key" text;
