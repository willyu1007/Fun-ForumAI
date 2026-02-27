CREATE TABLE "agent_relations" (
  "id" TEXT NOT NULL,
  "from_agent_id" TEXT NOT NULL,
  "to_agent_id" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'shadow',
  "relation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "interaction_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "persona_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "safety_score" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "shadow_started_at" TIMESTAMP(3),
  "effective_at" TIMESTAMP(3),
  "inactive_at" TIMESTAMP(3),
  "blocked_at" TIMESTAMP(3),
  "below_threshold_since" TIMESTAMP(3),
  "last_signal_at" TIMESTAMP(3),
  "last_interaction_at" TIMESTAMP(3),
  "last_evaluated_at" TIMESTAMP(3),
  "last_state_changed_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_relations_from_to_not_same_chk" CHECK ("from_agent_id" <> "to_agent_id")
);

CREATE UNIQUE INDEX "agent_relations_from_agent_id_to_agent_id_key"
  ON "agent_relations"("from_agent_id", "to_agent_id");

CREATE INDEX "agent_relations_from_agent_id_state_updated_at_idx"
  ON "agent_relations"("from_agent_id", "state", "updated_at");

CREATE INDEX "agent_relations_to_agent_id_state_updated_at_idx"
  ON "agent_relations"("to_agent_id", "state", "updated_at");

ALTER TABLE "agent_relations"
  ADD CONSTRAINT "agent_relations_from_agent_id_fkey"
  FOREIGN KEY ("from_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_relations"
  ADD CONSTRAINT "agent_relations_to_agent_id_fkey"
  FOREIGN KEY ("to_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "agent_relation_events" (
  "id" TEXT NOT NULL,
  "from_agent_id" TEXT NOT NULL,
  "to_agent_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "source_type" TEXT NOT NULL,
  "source_ref_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_relation_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_relation_events_from_to_not_same_chk" CHECK ("from_agent_id" <> "to_agent_id")
);

CREATE UNIQUE INDEX "agent_relation_events_idempotency_key_key"
  ON "agent_relation_events"("idempotency_key");

CREATE INDEX "agent_relation_events_from_agent_id_to_agent_id_created_at_idx"
  ON "agent_relation_events"("from_agent_id", "to_agent_id", "created_at");

CREATE INDEX "agent_relation_events_from_agent_id_to_agent_id_event_type__idx"
  ON "agent_relation_events"("from_agent_id", "to_agent_id", "event_type", "created_at");

ALTER TABLE "agent_relation_events"
  ADD CONSTRAINT "agent_relation_events_from_agent_id_fkey"
  FOREIGN KEY ("from_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_relation_events"
  ADD CONSTRAINT "agent_relation_events_to_agent_id_fkey"
  FOREIGN KEY ("to_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
