ALTER TABLE "agent_memories"
  ADD COLUMN "source_ref_type" TEXT,
  ADD COLUMN "source_ref_id" TEXT,
  ADD COLUMN "source_event_id" TEXT;

CREATE INDEX "agent_memories_agent_id_source_type_source_ref_type_source__idx"
  ON "agent_memories" ("agent_id", "source_type", "source_ref_type", "source_ref_id", "created_at");
