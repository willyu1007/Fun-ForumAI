-- T-074 chatroom program engine and highlights.
-- Extend watchability foundation with program events, beats, selection audit,
-- highlight persistence, and message/program metadata needed by the
-- second-stage web experience.

CREATE TYPE "RoomBeatType" AS ENUM (
  'OPENING',
  'HOOK',
  'EXPLAIN',
  'CLASH',
  'CALLBACK',
  'COOL_DOWN',
  'RECAP',
  'LANDING'
);

CREATE TYPE "RoomCueType" AS ENUM (
  'ADVANCE',
  'ASK',
  'CALLBACK',
  'SUMMARIZE',
  'COOL_DOWN',
  'CLOSE'
);

CREATE TYPE "RoomProgramEventType" AS ENUM (
  'RAW_MESSAGE',
  'ROOM_TICK',
  'PROGRAM_CUE'
);

CREATE TYPE "RoomProgramEventStatus" AS ENUM (
  'PENDING',
  'PLANNED',
  'EXECUTED',
  'SKIPPED',
  'FAILED'
);

CREATE TYPE "RoomHighlightKind" AS ENUM (
  'CALLBACK',
  'PUNCHLINE',
  'CHARACTER_MOMENT',
  'SUMMARY',
  'CLASH'
);

ALTER TABLE "room_programs"
  ADD COLUMN "callback_window" INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN "recap_every_turns" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "max_consecutive_turns" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idle_cue_after_ms" INTEGER NOT NULL DEFAULT 30000,
  ADD COLUMN "director_policy_json" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "room_episodes"
  ADD COLUMN "callback_bank_json" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "room_messages"
  ADD COLUMN "episode_id" TEXT,
  ADD COLUMN "beat_id" TEXT,
  ADD COLUMN "program_event_id" TEXT,
  ADD COLUMN "speaker_role" "RoomCastRole",
  ADD COLUMN "cue_type" "RoomCueType";

CREATE TABLE "room_episode_beats" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "beat_type" "RoomBeatType" NOT NULL,
  "cue_type" "RoomCueType" NOT NULL,
  "director_goal" TEXT NOT NULL,
  "prompt_hint" TEXT,
  "anchor_message_id" TEXT,
  "callback_message_id" TEXT,
  "target_role" "RoomCastRole",
  "selected_speaker_agent_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "audit_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "room_episode_beats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_program_events" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "beat_id" TEXT,
  "event_type" "RoomProgramEventType" NOT NULL,
  "status" "RoomProgramEventStatus" NOT NULL DEFAULT 'PENDING',
  "cue_type" "RoomCueType",
  "director_goal" TEXT,
  "selected_speaker_agent_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_json" JSONB,
  "error_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_program_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_selection_ledgers" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "beat_id" TEXT,
  "program_event_id" TEXT NOT NULL,
  "candidate_agent_id" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "final_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reasons_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_selection_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "room_highlights" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "episode_id" TEXT,
  "beat_id" TEXT,
  "source_message_id" TEXT NOT NULL,
  "kind" "RoomHighlightKind" NOT NULL,
  "text" TEXT NOT NULL,
  "actor_agent_ids_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_highlights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_episode_beats_episode_id_ordinal_key" ON "room_episode_beats"("episode_id", "ordinal");
CREATE INDEX "room_episode_beats_room_id_episode_id_created_at_idx" ON "room_episode_beats"("room_id", "episode_id", "created_at");

CREATE UNIQUE INDEX "room_program_events_idempotency_key_key" ON "room_program_events"("idempotency_key");
CREATE INDEX "room_program_events_room_id_created_at_idx" ON "room_program_events"("room_id", "created_at");
CREATE INDEX "room_program_events_episode_id_created_at_idx" ON "room_program_events"("episode_id", "created_at");

CREATE INDEX "room_selection_ledgers_room_id_created_at_idx" ON "room_selection_ledgers"("room_id", "created_at");
CREATE INDEX "room_selection_ledgers_program_event_id_selected_idx" ON "room_selection_ledgers"("program_event_id", "selected");

CREATE UNIQUE INDEX "room_highlights_source_message_id_key" ON "room_highlights"("source_message_id");
CREATE INDEX "room_highlights_room_id_created_at_idx" ON "room_highlights"("room_id", "created_at");
CREATE INDEX "room_highlights_episode_id_created_at_idx" ON "room_highlights"("episode_id", "created_at");

CREATE INDEX "room_messages_episode_id_idx" ON "room_messages"("episode_id");
CREATE INDEX "room_messages_beat_id_idx" ON "room_messages"("beat_id");
CREATE INDEX "room_messages_program_event_id_idx" ON "room_messages"("program_event_id");

ALTER TABLE "room_episode_beats"
  ADD CONSTRAINT "room_episode_beats_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episode_beats"
  ADD CONSTRAINT "room_episode_beats_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_episode_beats"
  ADD CONSTRAINT "room_episode_beats_selected_speaker_agent_id_fkey"
  FOREIGN KEY ("selected_speaker_agent_id") REFERENCES "agents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_program_events"
  ADD CONSTRAINT "room_program_events_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_program_events"
  ADD CONSTRAINT "room_program_events_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_program_events"
  ADD CONSTRAINT "room_program_events_beat_id_fkey"
  FOREIGN KEY ("beat_id") REFERENCES "room_episode_beats"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_program_events"
  ADD CONSTRAINT "room_program_events_selected_speaker_agent_id_fkey"
  FOREIGN KEY ("selected_speaker_agent_id") REFERENCES "agents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_selection_ledgers"
  ADD CONSTRAINT "room_selection_ledgers_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_selection_ledgers"
  ADD CONSTRAINT "room_selection_ledgers_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_selection_ledgers"
  ADD CONSTRAINT "room_selection_ledgers_beat_id_fkey"
  FOREIGN KEY ("beat_id") REFERENCES "room_episode_beats"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_selection_ledgers"
  ADD CONSTRAINT "room_selection_ledgers_program_event_id_fkey"
  FOREIGN KEY ("program_event_id") REFERENCES "room_program_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_selection_ledgers"
  ADD CONSTRAINT "room_selection_ledgers_candidate_agent_id_fkey"
  FOREIGN KEY ("candidate_agent_id") REFERENCES "agents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_highlights"
  ADD CONSTRAINT "room_highlights_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "room_highlights"
  ADD CONSTRAINT "room_highlights_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_highlights"
  ADD CONSTRAINT "room_highlights_beat_id_fkey"
  FOREIGN KEY ("beat_id") REFERENCES "room_episode_beats"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_messages"
  ADD CONSTRAINT "room_messages_episode_id_fkey"
  FOREIGN KEY ("episode_id") REFERENCES "room_episodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_messages"
  ADD CONSTRAINT "room_messages_beat_id_fkey"
  FOREIGN KEY ("beat_id") REFERENCES "room_episode_beats"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "room_messages"
  ADD CONSTRAINT "room_messages_program_event_id_fkey"
  FOREIGN KEY ("program_event_id") REFERENCES "room_program_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
