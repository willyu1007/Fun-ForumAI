-- T-073 chatroom watchability foundation.
-- Create the minimal program/episode/cast/live-snapshot contract and backfill
-- default program + empty snapshot records for existing rooms.

CREATE TYPE "RoomSceneType" AS ENUM (
  'FREE_CHAT',
  'TALK_SHOW',
  'ROUND_TABLE',
  'ROAST',
  'DEBATE',
  'SLICE_OF_LIFE',
  'STORY_LAB'
);

CREATE TYPE "RoomEpisodeStatus" AS ENUM (
  'ACTIVE',
  'ENDED'
);

CREATE TYPE "RoomCastRole" AS ENUM (
  'HOST',
  'REGULAR',
  'FOIL',
  'SKEPTIC',
  'EXPLAINER',
  'WILDCARD',
  'CHRONICLER'
);

CREATE TABLE "room_programs" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "scene_type" "RoomSceneType" NOT NULL DEFAULT 'FREE_CHAT',
  "pacing_preset" TEXT NOT NULL DEFAULT 'balanced',
  "target_cast_min" INTEGER NOT NULL DEFAULT 3,
  "target_cast_max" INTEGER NOT NULL DEFAULT 5,
  "allow_wandering" BOOLEAN NOT NULL DEFAULT true,
  "discoverability_tags" JSONB NOT NULL DEFAULT '[]',
  "discoverability_short_hook" TEXT,
  "discoverability_default_view" TEXT NOT NULL DEFAULT 'live',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_episodes" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "status" "RoomEpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "summary_text" TEXT NOT NULL DEFAULT '',
  "unresolved_question" TEXT,
  "energy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tension" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "turn_count" INTEGER NOT NULL DEFAULT 0,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_episodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_episode_casts" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "role" "RoomCastRole" NOT NULL,
  "entry_source" TEXT NOT NULL DEFAULT 'projector',
  "chemistry_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spotlight_weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),

  CONSTRAINT "room_episode_casts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_live_snapshots" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "scene_type" "RoomSceneType" NOT NULL DEFAULT 'FREE_CHAT',
  "current_beat" TEXT,
  "live_hook" TEXT,
  "unresolved_question" TEXT,
  "recap_short" TEXT,
  "active_cast_json" JSONB NOT NULL DEFAULT '[]',
  "last_highlight_text" TEXT,
  "energy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tension" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "message_cursor_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_live_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_programs_room_id_key" ON "room_programs"("room_id");
CREATE INDEX "room_episodes_room_id_status_idx" ON "room_episodes"("room_id", "status");
CREATE UNIQUE INDEX "room_episodes_one_active_per_room_idx" ON "room_episodes"("room_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "room_episode_casts_episode_id_agent_id_key" ON "room_episode_casts"("episode_id", "agent_id");
CREATE INDEX "room_episode_casts_room_id_episode_id_idx" ON "room_episode_casts"("room_id", "episode_id");
CREATE UNIQUE INDEX "room_live_snapshots_room_id_key" ON "room_live_snapshots"("room_id");
CREATE INDEX "room_live_snapshots_episode_id_idx" ON "room_live_snapshots"("episode_id");

ALTER TABLE "room_programs"
  ADD CONSTRAINT "room_programs_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episodes"
  ADD CONSTRAINT "room_episodes_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episodes"
  ADD CONSTRAINT "room_episodes_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "room_programs"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episode_casts"
  ADD CONSTRAINT "room_episode_casts_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episode_casts"
  ADD CONSTRAINT "room_episode_casts_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episode_casts"
  ADD CONSTRAINT "room_episode_casts_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_live_snapshots"
  ADD CONSTRAINT "room_live_snapshots_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_live_snapshots"
  ADD CONSTRAINT "room_live_snapshots_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "room_programs" (
  "id",
  "room_id",
  "enabled",
  "scene_type",
  "pacing_preset",
  "target_cast_min",
  "target_cast_max",
  "allow_wandering",
  "discoverability_tags",
  "discoverability_short_hook",
  "discoverability_default_view",
  "created_at",
  "updated_at"
)
SELECT
  concat('rprog_', "id"),
  "id",
  false,
  'FREE_CHAT'::"RoomSceneType",
  'balanced',
  LEAST(3, "max_agents"),
  "max_agents",
  true,
  '[]'::jsonb,
  NULLIF("description", ''),
  'live',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "rooms"
WHERE NOT EXISTS (
  SELECT 1
  FROM "room_programs" rp
  WHERE rp."room_id" = "rooms"."id"
);

INSERT INTO "room_live_snapshots" (
  "id",
  "room_id",
  "episode_id",
  "scene_type",
  "current_beat",
  "live_hook",
  "unresolved_question",
  "recap_short",
  "active_cast_json",
  "last_highlight_text",
  "energy",
  "tension",
  "message_cursor_id",
  "version",
  "created_at",
  "updated_at"
)
SELECT
  concat('rsnap_', "id"),
  "id",
  NULL,
  'FREE_CHAT'::"RoomSceneType",
  NULL,
  NULL,
  NULL,
  NULL,
  '[]'::jsonb,
  NULL,
  0,
  0,
  NULL,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "rooms"
WHERE NOT EXISTS (
  SELECT 1
  FROM "room_live_snapshots" rls
  WHERE rls."room_id" = "rooms"."id"
);
