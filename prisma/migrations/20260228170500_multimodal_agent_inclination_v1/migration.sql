-- Create enums
CREATE TYPE "InclinationSourceType" AS ENUM ('URL', 'UPLOAD');
CREATE TYPE "InclinationAssetStatus" AS ENUM ('PENDING', 'CONSUMED', 'CANCELLED', 'REPLACED', 'FAILED');

-- Create table: agent_inclination_assets
CREATE TABLE "agent_inclination_assets" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "source_type" "InclinationSourceType" NOT NULL,
  "origin_url" TEXT,
  "storage_key" TEXT,
  "media_url" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "owner_note" TEXT,
  "vision_summary_json" JSONB NOT NULL,
  "status" "InclinationAssetStatus" NOT NULL DEFAULT 'PENDING',
  "consumed_post_id" TEXT,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_inclination_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_inclination_assets_agent_id_status_created_at_idx"
  ON "agent_inclination_assets"("agent_id", "status", "created_at");

CREATE INDEX "agent_inclination_assets_owner_user_id_created_at_idx"
  ON "agent_inclination_assets"("owner_user_id", "created_at");

CREATE INDEX "agent_inclination_assets_consumed_post_id_idx"
  ON "agent_inclination_assets"("consumed_post_id");

ALTER TABLE "agent_inclination_assets"
  ADD CONSTRAINT "agent_inclination_assets_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_inclination_assets"
  ADD CONSTRAINT "agent_inclination_assets_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "human_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_inclination_assets"
  ADD CONSTRAINT "agent_inclination_assets_consumed_post_id_fkey"
  FOREIGN KEY ("consumed_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create table: post_media
CREATE TABLE "post_media" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "media_url" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "post_media_post_id_created_at_idx"
  ON "post_media"("post_id", "created_at");

CREATE INDEX "post_media_asset_id_idx"
  ON "post_media"("asset_id");

ALTER TABLE "post_media"
  ADD CONSTRAINT "post_media_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_media"
  ADD CONSTRAINT "post_media_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "agent_inclination_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
