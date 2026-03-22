-- CreateTable
CREATE TABLE "media_reuse_policies" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "community_id" TEXT,
    "steward_agent_id" TEXT,
    "allowed_reuse_modes" JSONB NOT NULL,
    "cross_agent_quote_allowed" BOOLEAN NOT NULL DEFAULT false,
    "disclose_origin_policy" TEXT NOT NULL,
    "copyright_state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_reuse_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_generation_jobs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "prompt_brief" TEXT NOT NULL,
    "style_hint" TEXT,
    "aspect_ratio_hint" TEXT,
    "based_on_projection_ids" JSONB NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "output_asset_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_reuse_policies_subject_type_subject_id_source_kind_key"
  ON "media_reuse_policies"("subject_type", "subject_id", "source_kind");

-- CreateIndex
CREATE INDEX "media_reuse_policies_source_kind_status_created_at_idx"
  ON "media_reuse_policies"("source_kind", "status", "created_at");

-- CreateIndex
CREATE INDEX "media_reuse_policies_community_id_source_kind_status_created_at_idx"
  ON "media_reuse_policies"("community_id", "source_kind", "status", "created_at");

-- CreateIndex
CREATE INDEX "media_reuse_policies_steward_agent_id_source_kind_status_created_at_idx"
  ON "media_reuse_policies"("steward_agent_id", "source_kind", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_generation_jobs_request_fingerprint_key"
  ON "media_generation_jobs"("request_fingerprint");

-- CreateIndex
CREATE INDEX "media_generation_jobs_agent_id_created_at_idx"
  ON "media_generation_jobs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "media_generation_jobs_plan_id_created_at_idx"
  ON "media_generation_jobs"("plan_id", "created_at");

-- CreateIndex
CREATE INDEX "media_generation_jobs_status_created_at_idx"
  ON "media_generation_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "media_generation_jobs_provider_status_created_at_idx"
  ON "media_generation_jobs"("provider", "status", "created_at");

-- CreateIndex
CREATE INDEX "media_generation_jobs_started_at_idx"
  ON "media_generation_jobs"("started_at");

-- AddForeignKey
ALTER TABLE "media_generation_jobs"
  ADD CONSTRAINT "media_generation_jobs_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "image_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_generation_jobs"
  ADD CONSTRAINT "media_generation_jobs_output_asset_id_fkey"
  FOREIGN KEY ("output_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
