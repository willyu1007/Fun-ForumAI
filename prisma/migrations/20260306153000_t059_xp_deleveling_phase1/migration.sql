ALTER TABLE "agent_stats"
ADD COLUMN IF NOT EXISTS "granted_points_total" INTEGER NOT NULL DEFAULT 0;

UPDATE "agent_stats" AS stats
SET
  "unspent_points" = stats."unspent_points" + GREATEST(
    FLOOR(growth."xp" / 50.0)::INTEGER - GREATEST(growth."level" - 1, 0),
    0
  ),
  "granted_points_total" = FLOOR(growth."xp" / 50.0)::INTEGER
FROM "agent_growth" AS growth
WHERE stats."agent_id" = growth."agent_id"
  AND (
    stats."granted_points_total" IS DISTINCT FROM FLOOR(growth."xp" / 50.0)::INTEGER
    OR stats."unspent_points" IS DISTINCT FROM stats."unspent_points" + GREATEST(
      FLOOR(growth."xp" / 50.0)::INTEGER - GREATEST(growth."level" - 1, 0),
      0
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'agent_growth'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'agent_xp'
  ) THEN
    ALTER TABLE "agent_growth" RENAME TO "agent_xp";
  END IF;
END $$;

ALTER TABLE "agent_xp"
DROP COLUMN IF EXISTS "level",
DROP COLUMN IF EXISTS "trait_slots",
DROP COLUMN IF EXISTS "instruction_slots";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'growth_events'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'legacy_growth_events_archive'
  ) THEN
    ALTER TABLE "growth_events" RENAME TO "legacy_growth_events_archive";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "xp_events" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "xp_delta" INTEGER NOT NULL DEFAULT 0,
  "dedup_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'xp_events_agent_id_fkey'
      AND table_name = 'xp_events'
  ) THEN
    ALTER TABLE "xp_events"
      ADD CONSTRAINT "xp_events_agent_id_fkey"
      FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "xp_events_agent_id_created_at_idx"
ON "xp_events"("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "xp_events_agent_id_dedup_key_created_at_idx"
ON "xp_events"("agent_id", "dedup_key", "created_at");

INSERT INTO "xp_events" (
  "id",
  "agent_id",
  "source",
  "title",
  "description",
  "xp_delta",
  "dedup_key",
  "created_at"
)
SELECT
  archive."id",
  archive."agent_id",
  CASE
    WHEN POSITION(' → ' IN archive."description") > 0 THEN SPLIT_PART(archive."description", ' → ', 1)
    WHEN POSITION(' -> ' IN archive."description") > 0 THEN SPLIT_PART(archive."description", ' -> ', 1)
    ELSE 'legacy_migrated'
  END AS "source",
  archive."title",
  archive."description",
  archive."xp_delta",
  NULLIF(SUBSTRING(archive."description" FROM 'dedup_key=([^|]+)$'), '') AS "dedup_key",
  archive."created_at"
FROM "legacy_growth_events_archive" AS archive
WHERE archive."event_type" = 'xp_gain'
  AND NOT EXISTS (
    SELECT 1
    FROM "xp_events" AS existing
    WHERE existing."id" = archive."id"
  );
