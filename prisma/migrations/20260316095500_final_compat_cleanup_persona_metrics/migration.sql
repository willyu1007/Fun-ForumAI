ALTER TABLE "persona_observability_metrics"
  DROP COLUMN IF EXISTS "retrieval_public_legacy_hits",
  DROP COLUMN IF EXISTS "retrieval_legacy_fallback_total",
  DROP COLUMN IF EXISTS "migration_public_dedup_legacy_fallbacks",
  DROP COLUMN IF EXISTS "migration_public_cooldown_legacy_fallbacks";
