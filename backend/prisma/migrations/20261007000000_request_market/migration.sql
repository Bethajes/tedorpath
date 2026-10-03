-- Which market a tutor request was made in.
--
-- Derived from the request's own `countryCode` at write time rather than on read, so
-- an admin reading the queue a year from now sees the market that applied when the
-- request was made. Re-deriving it later would answer a different question if the
-- default market or the country-to-market mapping ever changed.
--
-- Backfilled from `countryCode` rather than left null: the country has been required
-- on the wizard since it shipped, so for every existing row that is the market this
-- request belonged to. Ethiopia means ETB and everything else means the international
-- market — the same rule the application applies. Rows with no country keep a null
-- market, which is the honest answer.
ALTER TABLE "tutor_requests" ADD COLUMN "market" CHAR(3);

UPDATE "tutor_requests"
SET "market" = CASE WHEN "countryCode" = 'ET' THEN 'ETB' ELSE 'USD' END
WHERE "countryCode" IS NOT NULL;

CREATE INDEX "tutor_requests_market_idx" ON "tutor_requests" ("market");
