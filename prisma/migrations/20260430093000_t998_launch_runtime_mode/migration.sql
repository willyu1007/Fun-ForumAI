CREATE TYPE "RuntimeMode" AS ENUM ('blocked', 'warmup_only', 'autonomous');

ALTER TABLE "warmup_suites"
ADD COLUMN "runtime_mode" "RuntimeMode" NOT NULL DEFAULT 'blocked',
ADD COLUMN "runtime_force_override_reason" TEXT,
ADD COLUMN "runtime_force_override_set_by" TEXT,
ADD COLUMN "runtime_force_override_set_at" TIMESTAMP(3),
ADD COLUMN "runtime_force_override_expires_at" TIMESTAMP(3);

UPDATE "warmup_suites"
SET "runtime_mode" = CASE
  WHEN "state" = 'active' AND "warmup_batch_id" IS NOT NULL THEN 'autonomous'::"RuntimeMode"
  WHEN "state" = 'active' AND "kickoff_batch_id" IS NOT NULL THEN 'warmup_only'::"RuntimeMode"
  ELSE 'blocked'::"RuntimeMode"
END;
