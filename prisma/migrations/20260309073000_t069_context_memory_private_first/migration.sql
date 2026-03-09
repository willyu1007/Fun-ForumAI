-- CreateEnum
CREATE TYPE "ContextScene" AS ENUM ('FORUM', 'CHAT_ROOM', 'PRIVATE_CHAT');

-- CreateEnum
CREATE TYPE "ContextSourceType" AS ENUM ('PRIVATE_SESSION', 'FORUM_THREAD', 'CHAT_ROOM_WINDOW', 'NIGHTLY_COMPACTION');

-- CreateEnum
CREATE TYPE "ContextRelationChannel" AS ENUM ('OWNER', 'COMMUNITY', 'ROOM', 'AGENT');

-- CreateTable
CREATE TABLE "raw_context_events" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "scene" "ContextScene" NOT NULL,
    "source_type" "ContextSourceType" NOT NULL,
    "source_ref_id" TEXT,
    "counterpart_id" TEXT,
    "transcript" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_context_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodic_cards" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "event_id" TEXT,
    "scene" "ContextScene" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topic_tags" JSONB NOT NULL DEFAULT '[]',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "salience" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodic_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_relation_states" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "counterpart_id" TEXT NOT NULL,
    "channel" "ContextRelationChannel" NOT NULL,
    "stance" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_relation_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_model_states" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tensions" JSONB NOT NULL DEFAULT '[]',
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_model_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_tension_items" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_tension_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_shadow_memories" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "event_id" TEXT,
    "summary" TEXT NOT NULL,
    "public_safe_shadow" TEXT NOT NULL,
    "evidence_refs" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_shadow_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_context_events_agent_id_created_at_idx" ON "raw_context_events"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "raw_context_events_agent_id_scene_created_at_idx" ON "raw_context_events"("agent_id", "scene", "created_at");

-- CreateIndex
CREATE INDEX "raw_context_events_agent_id_source_type_source_ref_id_idx" ON "raw_context_events"("agent_id", "source_type", "source_ref_id");

-- CreateIndex
CREATE INDEX "episodic_cards_agent_id_created_at_idx" ON "episodic_cards"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "episodic_cards_agent_id_scene_created_at_idx" ON "episodic_cards"("agent_id", "scene", "created_at");

-- CreateIndex
CREATE INDEX "episodic_cards_agent_id_salience_created_at_idx" ON "episodic_cards"("agent_id", "salience", "created_at");

-- CreateIndex
CREATE INDEX "context_relation_states_agent_id_channel_updated_at_idx" ON "context_relation_states"("agent_id", "channel", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "context_relation_states_agent_id_counterpart_id_channel_key" ON "context_relation_states"("agent_id", "counterpart_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "self_model_states_agent_id_key" ON "self_model_states"("agent_id");

-- CreateIndex
CREATE INDEX "active_tension_items_agent_id_intensity_updated_at_idx" ON "active_tension_items"("agent_id", "intensity", "updated_at");

-- CreateIndex
CREATE INDEX "private_shadow_memories_agent_id_created_at_idx" ON "private_shadow_memories"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "raw_context_events" ADD CONSTRAINT "raw_context_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodic_cards" ADD CONSTRAINT "episodic_cards_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodic_cards" ADD CONSTRAINT "episodic_cards_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "raw_context_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_relation_states" ADD CONSTRAINT "context_relation_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_model_states" ADD CONSTRAINT "self_model_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_tension_items" ADD CONSTRAINT "active_tension_items_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_shadow_memories" ADD CONSTRAINT "private_shadow_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_shadow_memories" ADD CONSTRAINT "private_shadow_memories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "raw_context_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
