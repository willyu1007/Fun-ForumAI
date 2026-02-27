CREATE TABLE "agent_stats" (
  "agent_id" TEXT NOT NULL,
  "unspent_points" INTEGER NOT NULL DEFAULT 0,
  "sociability" INTEGER NOT NULL DEFAULT 0,
  "curiosity" INTEGER NOT NULL DEFAULT 0,
  "assertiveness" INTEGER NOT NULL DEFAULT 0,
  "empathy" INTEGER NOT NULL DEFAULT 0,
  "brashness" INTEGER NOT NULL DEFAULT 0,
  "cynicism" INTEGER NOT NULL DEFAULT 0,
  "stubbornness" INTEGER NOT NULL DEFAULT 0,
  "volatility" INTEGER NOT NULL DEFAULT 0,
  "memory" INTEGER NOT NULL DEFAULT 30,
  "learning" INTEGER NOT NULL DEFAULT 30,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_stats_pkey" PRIMARY KEY ("agent_id"),
  CONSTRAINT "agent_stats_sociability_range_chk" CHECK ("sociability" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_curiosity_range_chk" CHECK ("curiosity" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_assertiveness_range_chk" CHECK ("assertiveness" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_empathy_range_chk" CHECK ("empathy" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_brashness_range_chk" CHECK ("brashness" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_cynicism_range_chk" CHECK ("cynicism" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_stubbornness_range_chk" CHECK ("stubbornness" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_volatility_range_chk" CHECK ("volatility" BETWEEN -100 AND 100),
  CONSTRAINT "agent_stats_memory_range_chk" CHECK ("memory" BETWEEN 0 AND 100),
  CONSTRAINT "agent_stats_learning_range_chk" CHECK ("learning" BETWEEN 0 AND 100),
  CONSTRAINT "agent_stats_unspent_points_non_negative_chk" CHECK ("unspent_points" >= 0)
);

ALTER TABLE "agent_stats"
  ADD CONSTRAINT "agent_stats_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_states" (
  "agent_id" TEXT NOT NULL,
  "valence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "arousal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "irritability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fatigue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_states_pkey" PRIMARY KEY ("agent_id"),
  CONSTRAINT "agent_states_valence_range_chk" CHECK ("valence" BETWEEN -1 AND 1),
  CONSTRAINT "agent_states_arousal_range_chk" CHECK ("arousal" BETWEEN 0 AND 1),
  CONSTRAINT "agent_states_confidence_range_chk" CHECK ("confidence" BETWEEN -1 AND 1),
  CONSTRAINT "agent_states_irritability_range_chk" CHECK ("irritability" BETWEEN 0 AND 1),
  CONSTRAINT "agent_states_fatigue_range_chk" CHECK ("fatigue" BETWEEN 0 AND 1)
);

ALTER TABLE "agent_states"
  ADD CONSTRAINT "agent_states_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "agent_stat_events" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "delta_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_stat_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_stat_events_idempotency_key_key"
  ON "agent_stat_events"("idempotency_key");

CREATE INDEX "agent_stat_events_agent_id_created_at_idx"
  ON "agent_stat_events"("agent_id", "created_at");

ALTER TABLE "agent_stat_events"
  ADD CONSTRAINT "agent_stat_events_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
