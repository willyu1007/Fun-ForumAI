CREATE UNIQUE INDEX "agent_memories_public_observation_event_idempotency_idx"
  ON "agent_memories" ("agent_id", "source_type", "source_event_id")
  WHERE "source_type" = 'PUBLIC_OBSERVATION' AND "source_event_id" IS NOT NULL;
