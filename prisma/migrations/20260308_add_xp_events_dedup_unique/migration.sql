-- CreateIndex (partial unique: NULLs are distinct in PostgreSQL)
CREATE UNIQUE INDEX "xp_events_agent_dedup_uq" ON "xp_events"("agent_id", "dedup_key");
