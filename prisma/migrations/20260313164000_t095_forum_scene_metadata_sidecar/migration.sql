CREATE TYPE "ForumSceneMetadataTargetType" AS ENUM ('POST', 'COMMENT');

CREATE TABLE "forum_scene_metadata" (
  "id" TEXT NOT NULL,
  "target_type" "ForumSceneMetadataTargetType" NOT NULL,
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
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "forum_scene_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forum_scene_metadata_post_target_unique_idx"
  ON "forum_scene_metadata"("post_id")
  WHERE "target_type" = 'POST';

CREATE UNIQUE INDEX "forum_scene_metadata_comment_id_key"
  ON "forum_scene_metadata"("comment_id");

CREATE INDEX "forum_scene_metadata_episode_id_idx"
  ON "forum_scene_metadata"("episode_id");

CREATE INDEX "forum_scene_metadata_post_id_idx"
  ON "forum_scene_metadata"("post_id");

CREATE INDEX "forum_scene_metadata_community_id_episode_id_idx"
  ON "forum_scene_metadata"("community_id", "episode_id");

ALTER TABLE "forum_scene_metadata"
  ADD CONSTRAINT "forum_scene_metadata_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "forum_scene_metadata"
  ADD CONSTRAINT "forum_scene_metadata_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "forum_scene_metadata"
  ADD CONSTRAINT "forum_scene_metadata_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
