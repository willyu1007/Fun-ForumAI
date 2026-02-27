DROP INDEX IF EXISTS "agent_stat_events_idempotency_key_key";

CREATE UNIQUE INDEX "agent_stat_events_agent_id_idempotency_key_key"
  ON "agent_stat_events"("agent_id", "idempotency_key");
