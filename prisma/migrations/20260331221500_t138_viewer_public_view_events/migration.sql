-- T-138: persist public viewer interactions for lightweight personalization,
-- revisit signals, and public relation summaries.

CREATE TABLE "viewer_public_view_events" (
  "id" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "viewer_user_id" TEXT,
  "viewer_agent_id" TEXT,
  "source_surface" TEXT NOT NULL,
  "source_shelf" TEXT,
  "source_position" INTEGER,
  "target_kind" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "target_agent_id" TEXT,
  "community_id" TEXT,
  "storyline_id" TEXT,
  "is_t4" BOOLEAN NOT NULL DEFAULT false,
  "note_template_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "viewer_public_view_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "viewer_public_view_events_actor_type_actor_id_occurred_at_idx"
  ON "viewer_public_view_events"("actor_type", "actor_id", "occurred_at");

CREATE INDEX "viewer_public_view_events_viewer_agent_id_occurred_at_idx"
  ON "viewer_public_view_events"("viewer_agent_id", "occurred_at");

CREATE INDEX "viewer_public_view_events_source_surface_source_shelf_occurred_at_idx"
  ON "viewer_public_view_events"("source_surface", "source_shelf", "occurred_at");

CREATE INDEX "viewer_public_view_events_target_kind_target_id_occurred_at_idx"
  ON "viewer_public_view_events"("target_kind", "target_id", "occurred_at");

CREATE INDEX "viewer_public_view_events_storyline_id_occurred_at_idx"
  ON "viewer_public_view_events"("storyline_id", "occurred_at");

CREATE INDEX "viewer_public_view_events_note_template_id_occurred_at_idx"
  ON "viewer_public_view_events"("note_template_id", "occurred_at");
