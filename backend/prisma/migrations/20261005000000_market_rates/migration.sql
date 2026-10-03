-- Extensible, per-market tutor pricing.
--
-- Ethiopia is Tedor's primary local market and the international market is
-- secondary, but neither is a column: a tutor states a price per market in a
-- table, so a third market is a row rather than a schema change.
--
-- NO CONVERSION, ANYWHERE. There is no exchange rate in this codebase and this
-- migration does not invent one. Each rate moves across as the tutor's own
-- number, under the market its column was named after.

-- ------------------------------------------------------------------ markets
CREATE TABLE "markets" (
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "currencyName" VARCHAR(60) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "markets_code_upper" CHECK ("code" = UPPER("code")),
    CONSTRAINT "markets_decimals_range" CHECK ("decimals" BETWEEN 0 AND 4)
);

-- --------------------------------------------------------- tutor rate rows
CREATE TABLE "tutor_profile_rates" (
    "tutorProfileId" UUID NOT NULL,
    "marketCode" CHAR(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_profile_rates_pkey" PRIMARY KEY ("tutorProfileId", "marketCode"),
    -- A rate is a price, so it cannot be zero or negative. The old columns
    -- allowed zero, and any existing row carrying one is dropped by the CHECK
    -- rather than silently becoming a "free lessons" listing nobody chose.
    CONSTRAINT "tutor_profile_rates_amount_positive" CHECK ("amount" > 0)
);

-- The two shipped markets. Seeded here as well as in the seed script so the table
-- is never empty in a deployment that has not been seeded: an empty registry
-- would mean a directory with no prices on it at all.
INSERT INTO "markets" ("code", "name", "currencyName", "symbol", "decimals", "isDefault", "active", "sortOrder", "updatedAt")
VALUES
    ('ETB', 'Ethiopia',        'Ethiopian Birr',  'Br', 2, true,  true, 0, CURRENT_TIMESTAMP),
    ('USD', 'International',   'US Dollar',       '$',   2, false, true, 1, CURRENT_TIMESTAMP);

-- Carry the existing rates across. `WHERE "hourlyRateEtb" IS NOT NULL` and the
-- strict CHECK together mean a profile carrying a zero rate loses that row
-- rather than failing the migration: the profile is preserved either way, and a
-- tutor re-states the price rather than being blocked from deploying.
INSERT INTO "tutor_profile_rates" ("tutorProfileId", "marketCode", "amount", "createdAt", "updatedAt")
SELECT "id", 'ETB', "hourlyRateEtb", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tutor_profiles"
WHERE "hourlyRateEtb" IS NOT NULL AND "hourlyRateEtb" > 0
ON CONFLICT DO NOTHING;

INSERT INTO "tutor_profile_rates" ("tutorProfileId", "marketCode", "amount", "createdAt", "updatedAt")
SELECT "id", 'USD', "hourlyRateUsd", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tutor_profiles"
WHERE "hourlyRateUsd" IS NOT NULL AND "hourlyRateUsd" > 0
ON CONFLICT DO NOTHING;

ALTER TABLE "tutor_profiles"
    DROP COLUMN "hourlyRateEtb",
    DROP COLUMN "hourlyRateUsd";

-- A learner's saved country, which is the one market source that is an answer
-- rather than an inference.
ALTER TABLE "users"
    ADD COLUMN "countryCode" CHAR(2);

CREATE INDEX "tutor_profile_rates_marketCode_amount_idx"
    ON "tutor_profile_rates"("marketCode", "amount");

ALTER TABLE "tutor_profile_rates"
    ADD CONSTRAINT "tutor_profile_rates_tutorProfileId_fkey"
        FOREIGN KEY ("tutorProfileId") REFERENCES "tutor_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "markets"
    ADD CONSTRAINT "markets_rate_marketCode_fkey"
        FOREIGN KEY ("code") REFERENCES "currencies"("code")
        ON DELETE RESTRICT ON UPDATE CASCADE;
