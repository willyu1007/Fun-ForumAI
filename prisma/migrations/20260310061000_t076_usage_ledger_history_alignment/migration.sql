-- Align migration history with the current Prisma schema.
-- This creates the persisted LLM usage ledger table and normalizes legacy
-- constraint/index names so future diffs stay clean on fresh environments.

ALTER TABLE "agent_xp" RENAME CONSTRAINT "agent_growth_pkey" TO "agent_xp_pkey";

ALTER TABLE "legacy_growth_events_archive" RENAME CONSTRAINT "growth_events_pkey" TO "legacy_growth_events_archive_pkey";

CREATE TABLE "llm_usage_ledger" (
    "id" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "prompt_ref_id" TEXT NOT NULL,
    "prompt_ref_version" INTEGER NOT NULL,
    "provider_id" TEXT,
    "model_id" TEXT,
    "profile_id" TEXT,
    "pool_id" TEXT,
    "credential_id" TEXT,
    "voice_line_id" TEXT,
    "tier" TEXT,
    "fallback_level" TEXT,
    "billing_class" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "estimated_cost_cny" DOUBLE PRECISION,
    "reserved_cost_cny" DOUBLE PRECISION,
    "actual_cost_cny" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL,
    "error_code" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "platform_retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "llm_usage_ledger_agent_id_created_at_idx" ON "llm_usage_ledger"("agent_id", "created_at");

CREATE INDEX "llm_usage_ledger_provider_id_created_at_idx" ON "llm_usage_ledger"("provider_id", "created_at");

CREATE INDEX "llm_usage_ledger_billing_class_created_at_idx" ON "llm_usage_ledger"("billing_class", "created_at");

CREATE INDEX "llm_usage_ledger_trace_id_idx" ON "llm_usage_ledger"("trace_id");

ALTER TABLE "agent_xp" RENAME CONSTRAINT "agent_growth_agent_id_fkey" TO "agent_xp_agent_id_fkey";

ALTER TABLE "legacy_growth_events_archive" RENAME CONSTRAINT "growth_events_agent_id_fkey" TO "legacy_growth_events_archive_agent_id_fkey";

ALTER INDEX "growth_events_agent_id_created_at_idx" RENAME TO "legacy_growth_events_archive_agent_id_created_at_idx";
