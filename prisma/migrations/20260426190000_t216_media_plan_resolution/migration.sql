-- T-216 M1 cue-media-policy — `MediaPlanResolution` audit log.
-- One append-only row per cue attempt × media-pool item; captures the
-- planner's intent (requested_strength, requested_role) alongside the runtime
-- outcome (plan_outcome). M1 ships audit-only; M2 enables derivative_source
-- emission when the planner orchestrates anchor → derivative.

-- CreateEnum
CREATE TYPE "CueMediaPlanOutcome" AS ENUM (
  'RUNTIME_CONTEXT',
  'PUBLIC_DISPLAY',
  'DERIVATIVE_SOURCE',
  'NOT_USED',
  'BLOCKED',
  'DEGRADED'
);

-- CreateTable
CREATE TABLE "media_plan_resolutions" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "image_planner_decision_id" TEXT,
    "requested_strength" "CueMediaUsageStrength" NOT NULL,
    "requested_role" "CueMediaRole" NOT NULL,
    "plan_outcome" "CueMediaPlanOutcome" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_plan_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_plan_resolutions_attempt_id_idx" ON "media_plan_resolutions"("attempt_id");

-- CreateIndex
CREATE INDEX "media_plan_resolutions_asset_id_created_at_idx" ON "media_plan_resolutions"("asset_id", "created_at");

-- CreateIndex
CREATE INDEX "media_plan_resolutions_plan_outcome_created_at_idx" ON "media_plan_resolutions"("plan_outcome", "created_at");

-- AddForeignKey
ALTER TABLE "media_plan_resolutions" ADD CONSTRAINT "media_plan_resolutions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "cue_execution_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
