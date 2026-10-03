-- A tutor's hourly rate, stated once per market.
--
-- Tedor Tutors serves two markets: Ethiopian learners, who think in birr, and
-- learners outside Ethiopia, who think in dollars. So a tutor states their rate
-- in each market rather than the platform picking one and converting it.
--
-- Two columns rather than a rate plus a currency column, because there is no
-- longer a single "the" rate to label: a tutor charging 900 ETB for local lessons
-- and 12 USD for international ones has two prices, and neither is derived from
-- the other. Storing them as two named values also means the directory can sort
-- and range-filter on the one the visitor's market actually uses, which a single
-- numeric column cannot support across two currencies.
--
-- Both are nullable so a tutor can serve one market only — plenty of Ethiopian
-- tutors have no international rate, and plenty of international tutors have no
-- birr rate. The API requires at least one of the two.
--
-- WHY `hourlyRate` IS DROPPED RATHER THAN BACKFILLED
--
-- The old column held a bare number with no currency, so its unit was never
-- recorded and cannot be recovered. Copying it into either column would be a
-- guess, and a wrong guess here mis-prices someone's lessons — which is a far
-- worse defect than an unlabelled rate. The value is dropped and each tutor is
-- asked to state their two prices on their profile.
ALTER TABLE "tutor_profiles"
    DROP COLUMN "hourlyRate";

ALTER TABLE "tutor_profiles"
    ADD COLUMN "hourlyRateEtb" DECIMAL(10,2),
    ADD COLUMN "hourlyRateUsd" DECIMAL(10,2);

-- A rate is a price for an hour of someone's teaching, so it cannot be negative
-- and the two-decimal column already rejects a third. Zero is allowed: a tutor
-- listing a free first lesson is stating a price, and it is not our place to
-- decide otherwise.
ALTER TABLE "tutor_profiles"
    ADD CONSTRAINT "tutor_profiles_hourly_rates_positive"
    CHECK (
        ("hourlyRateEtb" IS NULL OR "hourlyRateEtb" >= 0)
        AND ("hourlyRateUsd" IS NULL OR "hourlyRateUsd" >= 0)
    );