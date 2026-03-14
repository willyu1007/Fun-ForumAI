CREATE TABLE "forum_scene_metadata_archive" (
  "id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "post_id" TEXT,
  "comment_id" TEXT,
  "episode_id" TEXT NOT NULL,
  "selection_id" TEXT NOT NULL,
  "episode_plan_id" TEXT NOT NULL,
  "local_intent_id" TEXT NOT NULL,
  "director_surface" TEXT NOT NULL,
  "actor_surface" TEXT NOT NULL,
  "scene_template_id" TEXT NOT NULL,
  "scene_template_version" TEXT NOT NULL,
  "scene_binding_id" TEXT,
  "overlay_id" TEXT,
  "beat_id" TEXT,
  "phase" TEXT NOT NULL,
  "selection_mode" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "payload_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archive_batch_id" TEXT NOT NULL,
  "archive_reason" TEXT NOT NULL,

  CONSTRAINT "forum_scene_metadata_archive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "forum_scene_metadata_archive_community_id_created_at_idx"
  ON "forum_scene_metadata_archive"("community_id", "created_at");

CREATE INDEX "forum_scene_metadata_archive_episode_id_idx"
  ON "forum_scene_metadata_archive"("episode_id");

CREATE INDEX "forum_scene_metadata_archive_archive_batch_id_archived_at_idx"
  ON "forum_scene_metadata_archive"("archive_batch_id", "archived_at");

CREATE TABLE "room_program_events_archive" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "beat_id" TEXT,
  "event_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "cue_type" TEXT,
  "director_goal" TEXT,
  "selected_speaker_agent_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_json" JSONB,
  "error_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archive_batch_id" TEXT NOT NULL,
  "archive_reason" TEXT NOT NULL,

  CONSTRAINT "room_program_events_archive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_program_events_archive_idempotency_key_key"
  ON "room_program_events_archive"("idempotency_key");

CREATE INDEX "room_program_events_archive_room_id_created_at_idx"
  ON "room_program_events_archive"("room_id", "created_at");

CREATE INDEX "room_program_events_archive_episode_id_created_at_idx"
  ON "room_program_events_archive"("episode_id", "created_at");

CREATE INDEX "room_program_events_archive_archive_batch_id_archived_at_idx"
  ON "room_program_events_archive"("archive_batch_id", "archived_at");

CREATE TABLE "runtime_scene_states_archive" (
  "id" TEXT NOT NULL,
  "runtime_scene_id" TEXT NOT NULL,
  "director_surface" TEXT NOT NULL,
  "actor_surface" TEXT NOT NULL,
  "community_id" TEXT,
  "room_id" TEXT,
  "episode_id" TEXT NOT NULL,
  "scene_template_id" TEXT NOT NULL,
  "scene_template_version" TEXT NOT NULL,
  "scene_binding_id" TEXT,
  "overlay_id" TEXT,
  "phase" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "fatigue_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "repetition_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cooldown_until" TIMESTAMP(3),
  "experiment_bucket" TEXT NOT NULL,
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "state_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archive_batch_id" TEXT NOT NULL,
  "archive_reason" TEXT NOT NULL,

  CONSTRAINT "runtime_scene_states_archive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runtime_scene_states_archive_runtime_scene_id_key"
  ON "runtime_scene_states_archive"("runtime_scene_id");

CREATE UNIQUE INDEX "runtime_scene_states_archive_episode_id_key"
  ON "runtime_scene_states_archive"("episode_id");

CREATE INDEX "runtime_scene_states_archive_director_surface_episode_id_idx"
  ON "runtime_scene_states_archive"("director_surface", "episode_id");

CREATE INDEX "runtime_scene_states_archive_room_id_status_idx"
  ON "runtime_scene_states_archive"("room_id", "status");

CREATE INDEX "runtime_scene_states_archive_community_id_status_idx"
  ON "runtime_scene_states_archive"("community_id", "status");

CREATE INDEX "runtime_scene_states_archive_experiment_bucket_status_idx"
  ON "runtime_scene_states_archive"("experiment_bucket", "status");

CREATE INDEX "runtime_scene_states_archive_archive_batch_id_archived_at_idx"
  ON "runtime_scene_states_archive"("archive_batch_id", "archived_at");

CREATE TABLE "director_history_maintenance_runs" (
  "id" TEXT NOT NULL,
  "job_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT false,
  "cutoff_at" TIMESTAMP(3),
  "archive_batch_id" TEXT,
  "stats_json" JSONB NOT NULL DEFAULT '{}',
  "error_text" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "director_history_maintenance_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "director_history_maintenance_runs_job_type_started_at_idx"
  ON "director_history_maintenance_runs"("job_type", "started_at");

CREATE INDEX "director_history_maintenance_runs_status_started_at_idx"
  ON "director_history_maintenance_runs"("status", "started_at");

CREATE TABLE "director_current_scope_summaries" (
  "id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "community_id" TEXT,
  "room_id" TEXT,
  "actor_surface" TEXT,
  "episode_id" TEXT,
  "scene_template_id" TEXT,
  "scene_binding_id" TEXT,
  "selection_mode" TEXT,
  "source_record_at" TIMESTAMP(3),
  "summary_json" JSONB NOT NULL DEFAULT '{}',
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "director_current_scope_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "director_current_scope_summaries_scope_key"
  ON "director_current_scope_summaries"("surface", "scope_key");

CREATE INDEX "director_current_scope_summaries_surface_refreshed_at_idx"
  ON "director_current_scope_summaries"("surface", "refreshed_at");

CREATE TABLE "director_historical_daily_summaries" (
  "id" TEXT NOT NULL,
  "day" TIMESTAMP(3) NOT NULL,
  "surface" TEXT NOT NULL,
  "actor_surface" TEXT,
  "source" TEXT,
  "selection_mode" TEXT,
  "close_reason" TEXT,
  "aftershow_mode" TEXT,
  "experiment_bucket" TEXT,
  "total_count" INTEGER NOT NULL DEFAULT 0,
  "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "director_historical_daily_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "director_historical_daily_summaries_scope_key"
  ON "director_historical_daily_summaries"(
    "day",
    "surface",
    "actor_surface",
    "source",
    "selection_mode",
    "close_reason",
    "aftershow_mode",
    "experiment_bucket"
  );

CREATE INDEX "director_historical_daily_summaries_surface_day_idx"
  ON "director_historical_daily_summaries"("surface", "day");
