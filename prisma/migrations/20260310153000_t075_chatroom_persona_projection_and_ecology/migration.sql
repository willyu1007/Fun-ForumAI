-- T-075 chatroom persona projection, owner control, and ecology.
-- Extend chatroom program/member controls and add public-safe projection +
-- shared-memory persistence for continuity, ecology, and canonization flows.

ALTER TABLE "room_programs"
  ADD COLUMN "wander_policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "room_memberships"
  ADD COLUMN "role_hint" "RoomCastRole",
  ADD COLUMN "wander_eligible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "spotlight_weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "suppressed_until" TIMESTAMP(3);

CREATE TABLE "room_shared_memories" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "memory_kind" TEXT NOT NULL DEFAULT 'CONTINUITY',
  "summary_text" TEXT NOT NULL,
  "tags_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "source_message_id" TEXT,
  "source_highlight_id" TEXT,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_shared_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_public_projections" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "scene_affinity_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "banter_style" TEXT NOT NULL DEFAULT 'balanced',
  "conflict_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "callback_habit" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "signature_moves_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "disclosure_policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "follow_targets_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "avoid_targets_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_public_projections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "room_shared_memories_room_id_created_at_idx" ON "room_shared_memories"("room_id", "created_at");
CREATE INDEX "room_shared_memories_episode_id_created_at_idx" ON "room_shared_memories"("episode_id", "created_at");
CREATE UNIQUE INDEX "agent_public_projections_agent_id_key" ON "agent_public_projections"("agent_id");
CREATE INDEX "agent_public_projections_updated_at_idx" ON "agent_public_projections"("updated_at");

ALTER TABLE "room_shared_memories"
  ADD CONSTRAINT "room_shared_memories_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_shared_memories"
  ADD CONSTRAINT "room_shared_memories_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_public_projections"
  ADD CONSTRAINT "agent_public_projections_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
