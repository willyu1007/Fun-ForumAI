-- T-048 Phase 1: Async PPR snapshots

CREATE TABLE "ppr_snapshots" (
  "id" TEXT NOT NULL,
  "source_agent_id" TEXT NOT NULL,
  "candidate_agent_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "topic_key" TEXT NOT NULL,
  "ppr_score" DOUBLE PRECISION NOT NULL,
  "rank" INTEGER NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ppr_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ppr_snapshots_source_agent_id_fkey" FOREIGN KEY ("source_agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ppr_snapshots_candidate_agent_id_fkey" FOREIGN KEY ("candidate_agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ppr_snapshots_source_agent_id_candidate_agent_id_community_id_topic_key_key"
  ON "ppr_snapshots"("source_agent_id", "candidate_agent_id", "community_id", "topic_key");

CREATE INDEX "ppr_snapshots_source_agent_id_community_id_topic_key_rank_idx"
  ON "ppr_snapshots"("source_agent_id", "community_id", "topic_key", "rank");

CREATE INDEX "ppr_snapshots_expires_at_idx"
  ON "ppr_snapshots"("expires_at");
