-- Database-driven configuration for the adaptive "Request a Tutor" wizard.
--
-- The wizard asks for a country first and derives everything else from it: the
-- currency the budget is shown in, the timezone availability is scheduled in,
-- the education levels offered, and the subjects suggested for the chosen
-- level. All of that lives here, so adding a country or reshaping a curriculum
-- is a data change rather than a release.
--
-- Compatibility. Every column added to `tutor_requests` is nullable (or has a
-- default), and the tables are new, so a request submitted by the original
-- single-page form still validates, still stores, and reads as null for
-- everything here. No backfill: there is nothing to back-fill from, and a row
-- that predates the wizard should honestly say so.

-- ---------------------------------------------------------------- currencies
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code"),
    -- A currency is shown next to a real amount of money, so these must hold.
    CONSTRAINT "currencies_code_upper" CHECK ("code" = UPPER("code")),
    CONSTRAINT "currencies_decimals_range" CHECK ("decimals" BETWEEN 0 AND 4),
    CONSTRAINT "currencies_symbol_present" CHECK (LENGTH(BTRIM("symbol")) > 0)
);

-- ------------------------------------------------------- education systems
CREATE TABLE "education_systems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_systems_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------- countries
-- `currencyCode` and `timezone` are defaults the form prefills from, not
-- declarations about the person filling it in. Both remain editable.
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CHAR(2) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "educationSystemId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id"),
    -- ISO 3166-1 alpha-2 is what the request stores, so the case is pinned here
    -- rather than being normalised by whichever code path happens to read it.
    CONSTRAINT "countries_code_upper" CHECK ("code" = UPPER("code") AND LENGTH("code") = 2)
);

-- --------------------------------------------------------- education levels
CREATE TABLE "education_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "stage" VARCHAR(40) NOT NULL,
    "educationSystemId" UUID NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------- education level suggestions
CREATE TABLE "education_level_subjects" (
    "educationLevelId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,

    CONSTRAINT "education_level_subjects_pkey" PRIMARY KEY ("educationLevelId", "subjectId")
);

-- ----------------------------------------------------------- learning goals
CREATE TABLE "learning_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------- tutor request configuration
ALTER TABLE "tutor_requests"
    ADD COLUMN "countryCode" CHAR(2),
    ADD COLUMN "timezone" VARCHAR(64),
    ADD COLUMN "educationLevelCode" VARCHAR(40),
    ADD COLUMN "subjectOther" VARCHAR(200),
    ADD COLUMN "learningGoal" VARCHAR(60),
    ADD COLUMN "learningGoalOther" VARCHAR(200),
    ADD COLUMN "preferredDayNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "preferredTimeRanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- The budget's amount and its currency are separate columns on purpose. An
    -- amount with no currency beside it is the exact failure this prevents, so
    -- the database refuses to hold one.
    ADD COLUMN "budgetAmount" DECIMAL(12,2),
    ADD COLUMN "budgetCurrency" CHAR(3),
    ADD CONSTRAINT "tutor_requests_budget_amount_with_currency"
        CHECK ("budgetAmount" IS NULL OR "budgetCurrency" IS NOT NULL),
    ADD CONSTRAINT "tutor_requests_budget_currency_upper"
        CHECK ("budgetCurrency" IS NULL OR "budgetCurrency" = UPPER("budgetCurrency"));

-- ------------------------------------------------- multi-subject requests
CREATE TABLE "tutor_request_subjects" (
    "tutorRequestId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,

    CONSTRAINT "tutor_request_subjects_pkey" PRIMARY KEY ("tutorRequestId", "subjectId")
);

-- ------------------------------------------------------------------- indexes
-- The `code` columns are what the seed upserts on and what the config endpoint
-- resolves against, so their uniqueness is a real constraint rather than a
-- convention. `currencies.code` is already the primary key above.
CREATE UNIQUE INDEX "education_systems_code_key" ON "education_systems"("code");
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE UNIQUE INDEX "education_levels_code_key" ON "education_levels"("code");
CREATE UNIQUE INDEX "learning_goals_code_key" ON "learning_goals"("code");

CREATE INDEX "currencies_sortOrder_idx" ON "currencies"("sortOrder");
CREATE INDEX "countries_sortOrder_idx" ON "countries"("sortOrder");
CREATE INDEX "education_levels_educationSystemId_sortOrder_idx" ON "education_levels"("educationSystemId", "sortOrder");
CREATE INDEX "education_level_subjects_subjectId_idx" ON "education_level_subjects"("subjectId");
CREATE INDEX "learning_goals_sortOrder_idx" ON "learning_goals"("sortOrder");
CREATE INDEX "tutor_requests_countryCode_idx" ON "tutor_requests"("countryCode");
CREATE INDEX "tutor_request_subjects_subjectId_idx" ON "tutor_request_subjects"("subjectId");

-- ------------------------------------------------------------ foreign keys
-- Added after the tables exist so the order above stays readable.
ALTER TABLE "countries"
    ADD CONSTRAINT "countries_currencyCode_fkey"
        FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code")
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "countries"
    ADD CONSTRAINT "countries_educationSystemId_fkey"
        FOREIGN KEY ("educationSystemId") REFERENCES "education_systems"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "education_levels"
    ADD CONSTRAINT "education_levels_educationSystemId_fkey"
        FOREIGN KEY ("educationSystemId") REFERENCES "education_systems"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "education_level_subjects"
    ADD CONSTRAINT "education_level_subjects_educationLevelId_fkey"
        FOREIGN KEY ("educationLevelId") REFERENCES "education_levels"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "education_level_subjects"
    ADD CONSTRAINT "education_level_subjects_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_request_subjects"
    ADD CONSTRAINT "tutor_request_subjects_tutorRequestId_fkey"
        FOREIGN KEY ("tutorRequestId") REFERENCES "tutor_requests"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tutor_request_subjects"
    ADD CONSTRAINT "tutor_request_subjects_subjectId_fkey"
        FOREIGN KEY ("subjectId") REFERENCES "subjects"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
