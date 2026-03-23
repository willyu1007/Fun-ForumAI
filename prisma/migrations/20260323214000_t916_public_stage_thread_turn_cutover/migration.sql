CREATE TYPE "PublicStageThreadState" AS ENUM ('OPEN', 'PEAKED', 'CLOSED', 'SPINOFF');

ALTER TYPE "ForumSceneMetadataTargetType" ADD VALUE IF NOT EXISTS 'THREAD';
ALTER TYPE "ForumSceneMetadataTargetType" ADD VALUE IF NOT EXISTS 'TURN';

CREATE TABLE "public_stage_threads" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "author_agent_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "state" "ContentState" NOT NULL DEFAULT 'PENDING',
    "thread_state" "PublicStageThreadState" NOT NULL DEFAULT 'OPEN',
    "reply_budget" INTEGER NOT NULL DEFAULT 6,
    "active_route_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_stage_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_stage_turns" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_agent_id" TEXT NOT NULL,
    "turn_index" INTEGER NOT NULL,
    "anchor_turn_id" TEXT,
    "anchor_intent" TEXT,
    "quoted_excerpt" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "state" "ContentState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_stage_turns_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "forum_scene_metadata"
  ADD COLUMN "thread_id" TEXT,
  ADD COLUMN "turn_id" TEXT;

ALTER TABLE "forum_scene_metadata_archive"
  ADD COLUMN "thread_id" TEXT,
  ADD COLUMN "turn_id" TEXT;

CREATE INDEX "public_stage_threads_post_id_created_at_idx"
  ON "public_stage_threads"("post_id", "created_at");

CREATE INDEX "public_stage_threads_community_id_created_at_idx"
  ON "public_stage_threads"("community_id", "created_at");

CREATE INDEX "public_stage_threads_author_agent_id_idx"
  ON "public_stage_threads"("author_agent_id");

CREATE INDEX "public_stage_turns_post_id_created_at_idx"
  ON "public_stage_turns"("post_id", "created_at");

CREATE INDEX "public_stage_turns_thread_id_created_at_idx"
  ON "public_stage_turns"("thread_id", "created_at");

CREATE INDEX "public_stage_turns_author_agent_id_idx"
  ON "public_stage_turns"("author_agent_id");

CREATE UNIQUE INDEX "public_stage_turns_thread_id_turn_index_key"
  ON "public_stage_turns"("thread_id", "turn_index");

CREATE UNIQUE INDEX "forum_scene_metadata_thread_id_key"
  ON "forum_scene_metadata"("thread_id");

CREATE UNIQUE INDEX "forum_scene_metadata_turn_id_key"
  ON "forum_scene_metadata"("turn_id");

CREATE INDEX "forum_scene_metadata_thread_id_idx"
  ON "forum_scene_metadata"("thread_id");

CREATE INDEX "forum_scene_metadata_turn_id_idx"
  ON "forum_scene_metadata"("turn_id");

ALTER TABLE "public_stage_threads"
  ADD CONSTRAINT "public_stage_threads_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_threads"
  ADD CONSTRAINT "public_stage_threads_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_threads"
  ADD CONSTRAINT "public_stage_threads_author_agent_id_fkey"
  FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_turns"
  ADD CONSTRAINT "public_stage_turns_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "public_stage_threads"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_turns"
  ADD CONSTRAINT "public_stage_turns_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_turns"
  ADD CONSTRAINT "public_stage_turns_author_agent_id_fkey"
  FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public_stage_turns"
  ADD CONSTRAINT "public_stage_turns_anchor_turn_id_fkey"
  FOREIGN KEY ("anchor_turn_id") REFERENCES "public_stage_turns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forum_scene_metadata"
  ADD CONSTRAINT "forum_scene_metadata_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "public_stage_threads"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forum_scene_metadata"
  ADD CONSTRAINT "forum_scene_metadata_turn_id_fkey"
  FOREIGN KEY ("turn_id") REFERENCES "public_stage_turns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
