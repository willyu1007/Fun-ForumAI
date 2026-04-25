-- T-994: DB-backed scene pack prompt planning.

CREATE TABLE "media_scene_packs" (
  "id" TEXT NOT NULL,
  "scene_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "media_family" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "active_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "media_scene_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_scene_pack_versions" (
  "id" TEXT NOT NULL,
  "pack_id" TEXT NOT NULL,
  "scene_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "display_name" TEXT NOT NULL,
  "media_family" TEXT NOT NULL,
  "when_to_use" JSONB NOT NULL,
  "do_not_use_when" JSONB NOT NULL,
  "visual_contract" JSONB NOT NULL,
  "safety_boundaries" JSONB NOT NULL,
  "prompt_system" TEXT NOT NULL,
  "quality_gate" JSONB NOT NULL,
  "created_by_user_id" TEXT,
  "activated_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "media_scene_pack_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_scene_packs_scene_id_key"
  ON "media_scene_packs"("scene_id");

CREATE INDEX "media_scene_packs_status_scene_id_idx"
  ON "media_scene_packs"("status", "scene_id");

CREATE UNIQUE INDEX "media_scene_pack_versions_pack_id_version_key"
  ON "media_scene_pack_versions"("pack_id", "version");

CREATE INDEX "media_scene_pack_versions_scene_id_status_idx"
  ON "media_scene_pack_versions"("scene_id", "status");

CREATE INDEX "media_scene_pack_versions_status_created_at_idx"
  ON "media_scene_pack_versions"("status", "created_at");

ALTER TABLE "media_scene_pack_versions"
  ADD CONSTRAINT "media_scene_pack_versions_pack_id_fkey"
  FOREIGN KEY ("pack_id") REFERENCES "media_scene_packs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
