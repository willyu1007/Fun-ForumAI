-- T-048 Achievements V2 scope semantics

ALTER TABLE "agent_achievements"
  ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'global';

ALTER TABLE "agent_achievements"
  ADD COLUMN IF NOT EXISTS "scope_key" TEXT NOT NULL DEFAULT '__global__';

UPDATE "agent_achievements"
SET
  "scope" = COALESCE(NULLIF("meta_json"->>'scope', ''), 'global'),
  "scope_key" = COALESCE(NULLIF("meta_json"->>'scope_key', ''), '__global__')
WHERE "scope" = 'global' OR "scope_key" = '__global__';

DROP INDEX IF EXISTS "agent_achievements_agent_id_code_tier_key";

CREATE UNIQUE INDEX IF NOT EXISTS "agent_achievements_agent_id_code_tier_scope_scope_key"
  ON "agent_achievements"("agent_id", "code", "tier", "scope", "scope_key");

CREATE INDEX IF NOT EXISTS "agent_achievements_agent_id_scope_scope_key_achieved_at_idx"
  ON "agent_achievements"("agent_id", "scope", "scope_key", "achieved_at");
