CREATE TABLE "runtime_scene_states" (
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
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "runtime_scene_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runtime_scene_states_runtime_scene_id_key"
  ON "runtime_scene_states"("runtime_scene_id");

CREATE UNIQUE INDEX "runtime_scene_states_episode_id_key"
  ON "runtime_scene_states"("episode_id");

CREATE INDEX "runtime_scene_states_director_surface_episode_id_idx"
  ON "runtime_scene_states"("director_surface", "episode_id");

CREATE INDEX "runtime_scene_states_room_id_status_idx"
  ON "runtime_scene_states"("room_id", "status");

CREATE INDEX "runtime_scene_states_community_id_status_idx"
  ON "runtime_scene_states"("community_id", "status");

CREATE INDEX "runtime_scene_states_experiment_bucket_status_idx"
  ON "runtime_scene_states"("experiment_bucket", "status");

ALTER TABLE "runtime_scene_states"
  ADD CONSTRAINT "runtime_scene_states_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
