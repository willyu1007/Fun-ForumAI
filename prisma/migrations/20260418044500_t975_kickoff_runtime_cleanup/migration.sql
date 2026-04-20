-- Collapse dormant candidate lifecycle storage into the single-track kickoff + runtime-only warmup model.

UPDATE "warmup_suites"
SET
  "state" = 'archived',
  "archived_at" = COALESCE("archived_at", NOW())
WHERE "state" = 'review_ready';

UPDATE "warm_start_batches"
SET
  "state" = 'archived',
  "archived_at" = COALESCE("archived_at", NOW())
WHERE "state" = 'review_ready';

DROP TABLE IF EXISTS "warmup_suite_reviews";
DROP TABLE IF EXISTS "active_baselines";
DROP TABLE IF EXISTS "governance_batches";

DROP TYPE IF EXISTS "WarmupReviewDecision";
DROP TYPE IF EXISTS "GovernanceBatchAction";

CREATE TYPE "WarmupSuiteState_new" AS ENUM ('draft', 'active', 'archived');
ALTER TABLE "warmup_suites" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "warmup_suites"
  ALTER COLUMN "state" TYPE "WarmupSuiteState_new"
  USING ("state"::text::"WarmupSuiteState_new");
ALTER TABLE "warmup_suites" ALTER COLUMN "state" SET DEFAULT 'draft';
DROP TYPE "WarmupSuiteState";
ALTER TYPE "WarmupSuiteState_new" RENAME TO "WarmupSuiteState";

CREATE TYPE "WarmStartBatchState_new" AS ENUM ('draft', 'generating', 'active', 'archived', 'failed');
ALTER TABLE "warm_start_batches" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "warm_start_batches"
  ALTER COLUMN "state" TYPE "WarmStartBatchState_new"
  USING ("state"::text::"WarmStartBatchState_new");
ALTER TABLE "warm_start_batches" ALTER COLUMN "state" SET DEFAULT 'draft';
DROP TYPE "WarmStartBatchState";
ALTER TYPE "WarmStartBatchState_new" RENAME TO "WarmStartBatchState";
