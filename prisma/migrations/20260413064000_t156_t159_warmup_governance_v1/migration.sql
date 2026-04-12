-- CreateEnum
CREATE TYPE "WarmupSuiteState" AS ENUM ('draft', 'review_ready', 'active', 'archived');

-- CreateEnum
CREATE TYPE "WarmStartBatchKind" AS ENUM ('kickoff', 'warmup');

-- CreateEnum
CREATE TYPE "WarmStartBatchState" AS ENUM (
  'draft',
  'generating',
  'review_ready',
  'active',
  'archived',
  'failed'
);

-- CreateEnum
CREATE TYPE "WarmupReviewDecision" AS ENUM ('pass_to_active', 'not_passed');

-- CreateEnum
CREATE TYPE "GovernanceBatchAction" AS ENUM ('quarantine', 'restore', 'archive');

-- AlterTable
ALTER TABLE "posts"
ADD COLUMN "warm_start_batch_id" TEXT,
ADD COLUMN "generation_mode" TEXT;

-- AlterTable
ALTER TABLE "public_stage_threads"
ADD COLUMN "warm_start_batch_id" TEXT,
ADD COLUMN "generation_mode" TEXT;

-- AlterTable
ALTER TABLE "public_stage_turns"
ADD COLUMN "warm_start_batch_id" TEXT,
ADD COLUMN "generation_mode" TEXT;

-- AlterTable
ALTER TABLE "post_media"
ADD COLUMN "warm_start_batch_id" TEXT,
ADD COLUMN "generation_mode" TEXT;

-- CreateTable
CREATE TABLE "warmup_suites" (
  "id" TEXT NOT NULL,
  "state" "WarmupSuiteState" NOT NULL DEFAULT 'draft',
  "suite_label" TEXT,
  "kickoff_batch_id" TEXT,
  "warmup_batch_id" TEXT,
  "created_by_user_id" TEXT,
  "activated_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "warmup_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warm_start_batches" (
  "id" TEXT NOT NULL,
  "suite_id" TEXT NOT NULL,
  "batch_kind" "WarmStartBatchKind" NOT NULL,
  "state" "WarmStartBatchState" NOT NULL DEFAULT 'draft',
  "source_batch_id" TEXT,
  "revision_key" TEXT,
  "package_hash" TEXT,
  "notes" TEXT,
  "activated_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "warm_start_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_suite_reviews" (
  "id" TEXT NOT NULL,
  "suite_id" TEXT NOT NULL,
  "reviewer_user_id" TEXT,
  "decision" "WarmupReviewDecision" NOT NULL,
  "reason_codes_json" JSONB NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "warmup_suite_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_baselines" (
  "id" TEXT NOT NULL,
  "suite_id" TEXT NOT NULL,
  "kickoff_batch_id" TEXT NOT NULL,
  "warmup_batch_id" TEXT NOT NULL,
  "previous_baseline_id" TEXT,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "activated_by_user_id" TEXT,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivated_at" TIMESTAMP(3),

  CONSTRAINT "active_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_batches" (
  "id" TEXT NOT NULL,
  "action" "GovernanceBatchAction" NOT NULL,
  "requested_by_user_id" TEXT,
  "suite_id" TEXT,
  "warm_start_batch_ids_json" JSONB NOT NULL,
  "content_ids_json" JSONB NOT NULL,
  "scope_json" JSONB NOT NULL,
  "preview_json" JSONB NOT NULL,
  "result_json" JSONB,
  "executed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "governance_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posts_warm_start_batch_id_created_at_idx"
ON "posts"("warm_start_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_generation_mode_created_at_idx"
ON "posts"("generation_mode", "created_at");

-- CreateIndex
CREATE INDEX "public_stage_threads_warm_start_batch_id_created_at_idx"
ON "public_stage_threads"("warm_start_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "public_stage_turns_warm_start_batch_id_created_at_idx"
ON "public_stage_turns"("warm_start_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "post_media_warm_start_batch_id_created_at_idx"
ON "post_media"("warm_start_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "warmup_suites_state_created_at_idx"
ON "warmup_suites"("state", "created_at");

-- CreateIndex
CREATE INDEX "warm_start_batches_suite_id_batch_kind_created_at_idx"
ON "warm_start_batches"("suite_id", "batch_kind", "created_at");

-- CreateIndex
CREATE INDEX "warm_start_batches_state_created_at_idx"
ON "warm_start_batches"("state", "created_at");

-- CreateIndex
CREATE INDEX "warmup_suite_reviews_suite_id_created_at_idx"
ON "warmup_suite_reviews"("suite_id", "created_at");

-- CreateIndex
CREATE INDEX "active_baselines_is_current_activated_at_idx"
ON "active_baselines"("is_current", "activated_at");

-- CreateIndex
CREATE INDEX "active_baselines_suite_id_activated_at_idx"
ON "active_baselines"("suite_id", "activated_at");

-- CreateIndex
CREATE INDEX "governance_batches_action_created_at_idx"
ON "governance_batches"("action", "created_at");

-- CreateIndex
CREATE INDEX "governance_batches_suite_id_created_at_idx"
ON "governance_batches"("suite_id", "created_at");
