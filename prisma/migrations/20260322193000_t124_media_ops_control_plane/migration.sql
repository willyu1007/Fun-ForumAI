-- T-124 media ops control plane

CREATE TABLE "media_observability_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "agent_id" TEXT,
  "community_id" TEXT,
  "image_plan_id" TEXT,
  "generation_job_id" TEXT,
  "asset_id" TEXT,
  "source_kind" TEXT,
  "metric_value" DOUBLE PRECISION,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_observability_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_observability_events_created_at_idx"
  ON "media_observability_events"("created_at");
CREATE INDEX "media_observability_events_event_type_created_at_idx"
  ON "media_observability_events"("event_type", "created_at");
CREATE INDEX "media_observability_events_surface_created_at_idx"
  ON "media_observability_events"("surface", "created_at");
CREATE INDEX "media_observability_events_severity_created_at_idx"
  ON "media_observability_events"("severity", "created_at");
CREATE INDEX "media_observability_events_agent_id_created_at_idx"
  ON "media_observability_events"("agent_id", "created_at");
CREATE INDEX "media_observability_events_community_id_created_at_idx"
  ON "media_observability_events"("community_id", "created_at");
CREATE INDEX "media_observability_events_image_plan_id_created_at_idx"
  ON "media_observability_events"("image_plan_id", "created_at");
CREATE INDEX "media_observability_events_generation_job_id_created_at_idx"
  ON "media_observability_events"("generation_job_id", "created_at");
CREATE INDEX "media_observability_events_asset_id_created_at_idx"
  ON "media_observability_events"("asset_id", "created_at");

CREATE TABLE "media_rollout_controller_overrides" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "mode" TEXT NOT NULL DEFAULT 'AUTO',
  "target_min_rate" DOUBLE PRECISION,
  "target_max_rate" DOUBLE PRECISION,
  "threshold_delta" DOUBLE PRECISION,
  "allow_generation" BOOLEAN,
  "generation_tier" TEXT,
  "sync_generation_ms_budget" INTEGER,
  "allow_private_runtime_projection" BOOLEAN,
  "allow_private_inspired_generation" BOOLEAN,
  "force_safe_mode" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "released_by_user_id" TEXT,
  "released_reason" TEXT,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_rollout_controller_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_rollout_controller_overrides_status_created_at_idx"
  ON "media_rollout_controller_overrides"("status", "created_at");
CREATE INDEX "media_rollout_controller_overrides_mode_created_at_idx"
  ON "media_rollout_controller_overrides"("mode", "created_at");
CREATE UNIQUE INDEX "media_rollout_controller_overrides_single_active_idx"
  ON "media_rollout_controller_overrides" ((1))
  WHERE "status" = 'active';
