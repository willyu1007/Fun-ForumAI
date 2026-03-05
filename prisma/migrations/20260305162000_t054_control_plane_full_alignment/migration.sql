-- Create ConfigVersionStatus enum (idempotent for partially applied databases).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ConfigVersionStatus'
  ) THEN
    CREATE TYPE "ConfigVersionStatus" AS ENUM ('ACTIVE', 'ROLLED_BACK', 'RETIRED');
  END IF;
END $$;

-- Normalize ConfigPatchStatus enum into v2 values with recovery for partial failures.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ConfigPatchStatus_old'
  ) THEN
    -- rename already completed in a previous attempt
    NULL;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ConfigPatchStatus'
      AND e.enumlabel = 'DRAFT'
  ) THEN
    ALTER TYPE "ConfigPatchStatus" RENAME TO "ConfigPatchStatus_old";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ConfigPatchStatus'
  ) THEN
    CREATE TYPE "ConfigPatchStatus" AS ENUM ('PROPOSED', 'VALIDATED', 'APPROVED', 'SCHEDULED', 'APPLIED', 'REJECTED', 'ROLLED_BACK');
  END IF;
END $$;

-- Add new columns for version/patch lifecycle.
ALTER TABLE "community_config_versions"
ADD COLUMN IF NOT EXISTS "status" "ConfigVersionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "effective_at" TIMESTAMP(3);

ALTER TABLE "community_config_patches"
ADD COLUMN IF NOT EXISTS "effective_at" TIMESTAMP(3);

-- Cast patch status to new enum when still on legacy type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'community_config_patches'
      AND column_name = 'status'
      AND udt_name = 'ConfigPatchStatus_old'
  ) THEN
    ALTER TABLE "community_config_patches"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "ConfigPatchStatus"
    USING (
      CASE
        WHEN "status"::text = 'DRAFT' THEN 'PROPOSED'
        ELSE "status"::text
      END::"ConfigPatchStatus"
    ),
    ALTER COLUMN "status" SET DEFAULT 'PROPOSED';
  ELSE
    ALTER TABLE "community_config_patches"
    ALTER COLUMN "status" SET DEFAULT 'PROPOSED';
  END IF;
END $$;

-- Drop the old enum only after no table still references it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ConfigPatchStatus_old'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE t.typname = 'ConfigPatchStatus_old'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'p')
  ) THEN
    DROP TYPE "ConfigPatchStatus_old";
  END IF;
END $$;

-- Normalize historical events to T-054 naming.
UPDATE "events"
SET "event_type" = 'COMMUNITY_CONFIG_ACTIVATED'
WHERE "event_type" = 'COMMUNITY_CONFIG_COMPONENT_ACK';

UPDATE "events"
SET "event_type" = 'COMMUNITY_CONFIG_VALIDATION_FAILED'
WHERE "event_type" = 'COMMUNITY_CONFIG_VALIDATED'
  AND COALESCE(("payload_json"->>'status'), '') = 'REJECTED';

UPDATE "events"
SET "event_type" = 'COMMUNITY_CONFIG_REJECTED'
WHERE "event_type" = 'COMMUNITY_CONFIG_APPROVED'
  AND COALESCE(("payload_json"->>'decision'), '') = 'REJECTED';

-- Scheduler index (idempotent).
CREATE INDEX IF NOT EXISTS "community_config_patches_status_effective_at_idx"
ON "community_config_patches"("status", "effective_at");
