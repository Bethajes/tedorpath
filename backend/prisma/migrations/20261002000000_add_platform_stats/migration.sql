-- Admin-controlled overrides for the homepage statistics band.
--
-- One row, created lazily: an empty table means "no overrides", which is the
-- state the platform ships in, so there is no seed row here.
--
-- Every count column is nullable and NULL means "use the live count". The
-- `id` check constraint makes "exactly one settings row" a database guarantee
-- rather than something the service layer has to be trusted to preserve.

CREATE TABLE "platform_stats" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "approvedTutors" INTEGER,
    "subjects" INTEGER,
    "universities" INTEGER,
    "countries" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_stats_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_stats_singleton_id" CHECK ("id" = 'singleton'),
    CONSTRAINT "platform_stats_approvedTutors_positive" CHECK ("approvedTutors" IS NULL OR "approvedTutors" > 0),
    CONSTRAINT "platform_stats_subjects_positive" CHECK ("subjects" IS NULL OR "subjects" > 0),
    CONSTRAINT "platform_stats_universities_positive" CHECK ("universities" IS NULL OR "universities" > 0),
    CONSTRAINT "platform_stats_countries_positive" CHECK ("countries" IS NULL OR "countries" > 0)
);
