-- T-981: persist a snapshot of the public bio text at the moment a render log is committed,
-- so that /v1/agents/:agentId/highlights can surface the N most recent public bio updates.

ALTER TABLE "agent_bio_render_logs"
  ADD COLUMN "public_bio_snapshot" TEXT;
