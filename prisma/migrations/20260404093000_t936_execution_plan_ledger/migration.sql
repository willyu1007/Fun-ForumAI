ALTER TABLE "llm_usage_ledger"
ADD COLUMN "policy_id" TEXT,
ADD COLUMN "adapter_id" TEXT,
ADD COLUMN "route_order_json" JSONB,
ADD COLUMN "ordered_candidates_json" JSONB,
ADD COLUMN "fallback_chain_json" JSONB,
ADD COLUMN "fallback_history_json" JSONB,
ADD COLUMN "merge_trace_json" JSONB,
ADD COLUMN "resolved_params_json" JSONB;

CREATE INDEX "llm_usage_ledger_policy_id_created_at_idx"
ON "llm_usage_ledger"("policy_id", "created_at");
