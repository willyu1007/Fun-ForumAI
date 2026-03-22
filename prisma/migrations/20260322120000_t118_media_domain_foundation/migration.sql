-- Create table: media_assets
CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "steward_agent_id" TEXT,
  "owner_user_id" TEXT,
  "source_kind" TEXT NOT NULL,
  "source_scene_type" TEXT,
  "source_scene_id" TEXT,
  "visibility_policy" TEXT NOT NULL,
  "lifecycle_status" TEXT NOT NULL,
  "storage_key" TEXT,
  "origin_url" TEXT,
  "mime_type" TEXT NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" TEXT NOT NULL,
  "phash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_assets_steward_agent_id_created_at_idx"
  ON "media_assets"("steward_agent_id", "created_at");

CREATE INDEX "media_assets_owner_user_id_created_at_idx"
  ON "media_assets"("owner_user_id", "created_at");

CREATE INDEX "media_assets_source_kind_created_at_idx"
  ON "media_assets"("source_kind", "created_at");

CREATE INDEX "media_assets_visibility_policy_lifecycle_status_created_at_idx"
  ON "media_assets"("visibility_policy", "lifecycle_status", "created_at");

CREATE INDEX "media_assets_sha256_idx"
  ON "media_assets"("sha256");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_steward_agent_id_fkey"
  FOREIGN KEY ("steward_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create table: media_semantic_snapshots
CREATE TABLE "media_semantic_snapshots" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "snapshot_kind" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "model_provider" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "model_version" TEXT NOT NULL,
  "summary_json" JSONB NOT NULL,
  "extraction_status" TEXT NOT NULL DEFAULT 'completed',
  "quality_grade" TEXT NOT NULL DEFAULT 'rich',
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_semantic_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_semantic_snapshots_asset_id_is_current_created_at_idx"
  ON "media_semantic_snapshots"("asset_id", "is_current", "created_at");

ALTER TABLE "media_semantic_snapshots"
  ADD CONSTRAINT "media_semantic_snapshots_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create table: scene_media_bindings
CREATE TABLE "scene_media_bindings" (
  "id" TEXT NOT NULL,
  "scene_type" TEXT NOT NULL,
  "scene_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "semantic_snapshot_id" TEXT NOT NULL,
  "source_scene_type" TEXT,
  "source_scene_id" TEXT,
  "binding_role" TEXT NOT NULL,
  "relation_to_scene" TEXT NOT NULL,
  "binding_note_text" TEXT,
  "display_policy" TEXT NOT NULL,
  "created_by_type" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scene_media_bindings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scene_media_bindings_scene_type_scene_id_created_at_idx"
  ON "scene_media_bindings"("scene_type", "scene_id", "created_at");

CREATE INDEX "scene_media_bindings_asset_id_scene_type_created_at_idx"
  ON "scene_media_bindings"("asset_id", "scene_type", "created_at");

CREATE INDEX "scene_media_bindings_semantic_snapshot_id_created_at_idx"
  ON "scene_media_bindings"("semantic_snapshot_id", "created_at");

ALTER TABLE "scene_media_bindings"
  ADD CONSTRAINT "scene_media_bindings_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scene_media_bindings"
  ADD CONSTRAINT "scene_media_bindings_semantic_snapshot_id_fkey"
  FOREIGN KEY ("semantic_snapshot_id") REFERENCES "media_semantic_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create table: media_context_projections
CREATE TABLE "media_context_projections" (
  "id" TEXT NOT NULL,
  "binding_id" TEXT NOT NULL,
  "projection_surface" TEXT NOT NULL,
  "projection_kind" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "token_estimate" INTEGER,
  "prompt_weight" TEXT,
  "mention_policy" TEXT,
  "preferred_display_variant" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "media_context_projections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_context_projections_binding_id_projection_surface_projection_kind_idx"
  ON "media_context_projections"("binding_id", "projection_surface", "projection_kind");

ALTER TABLE "media_context_projections"
  ADD CONSTRAINT "media_context_projections_binding_id_fkey"
  FOREIGN KEY ("binding_id") REFERENCES "scene_media_bindings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed baseline media_assets rows from legacy inclination assets so post_media can pivot FK safely.
INSERT INTO "media_assets" (
  "id",
  "steward_agent_id",
  "owner_user_id",
  "source_kind",
  "visibility_policy",
  "lifecycle_status",
  "storage_key",
  "origin_url",
  "mime_type",
  "file_size_bytes",
  "sha256",
  "created_at",
  "updated_at"
)
SELECT
  legacy."id",
  legacy."agent_id",
  legacy."owner_user_id",
  CASE
    WHEN legacy."source_type" = 'UPLOAD' THEN 'owner_console_upload'
    ELSE 'url_import'
  END,
  CASE
    WHEN legacy."consumed_post_id" IS NOT NULL OR legacy."status" = 'CONSUMED' THEN 'public_original_allowed'
    WHEN legacy."status" = 'FAILED' THEN 'blocked'
    ELSE 'private_only'
  END,
  CASE
    WHEN legacy."status" IN ('CANCELLED', 'REPLACED') THEN 'archived'
    WHEN legacy."status" = 'FAILED' THEN 'blocked'
    ELSE 'active'
  END,
  legacy."storage_key",
  legacy."origin_url",
  legacy."mime_type",
  legacy."file_size_bytes",
  CONCAT('legacy-pending:', legacy."id"),
  legacy."created_at",
  legacy."created_at"
FROM "agent_inclination_assets" AS legacy
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "post_media" DROP CONSTRAINT "post_media_asset_id_fkey";

ALTER TABLE "post_media"
  ADD CONSTRAINT "post_media_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
