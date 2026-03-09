CREATE TABLE "persona_observability_metrics" (
    "instance_id" TEXT NOT NULL,
    "runtime_key" TEXT NOT NULL,
    "public_ingress_forum_total" INTEGER NOT NULL DEFAULT 0,
    "public_ingress_chat_room_total" INTEGER NOT NULL DEFAULT 0,
    "typed_write_success_total" INTEGER NOT NULL DEFAULT 0,
    "typed_write_failure_total" INTEGER NOT NULL DEFAULT 0,
    "identity_write_success_total" INTEGER NOT NULL DEFAULT 0,
    "identity_write_failure_total" INTEGER NOT NULL DEFAULT 0,
    "retrieval_total" INTEGER NOT NULL DEFAULT 0,
    "retrieval_public_typed_hits" INTEGER NOT NULL DEFAULT 0,
    "retrieval_public_legacy_hits" INTEGER NOT NULL DEFAULT 0,
    "retrieval_legacy_fallback_total" INTEGER NOT NULL DEFAULT 0,
    "migration_public_dedup_legacy_fallbacks" INTEGER NOT NULL DEFAULT 0,
    "migration_public_cooldown_legacy_fallbacks" INTEGER NOT NULL DEFAULT 0,
    "migration_public_dual_write_total" INTEGER NOT NULL DEFAULT 0,
    "nightly_compaction_runs_total" INTEGER NOT NULL DEFAULT 0,
    "nightly_compaction_created_total" INTEGER NOT NULL DEFAULT 0,
    "nightly_compaction_dedup_hits_total" INTEGER NOT NULL DEFAULT 0,
    "nightly_compaction_failure_total" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persona_observability_metrics_pkey" PRIMARY KEY ("instance_id")
);

CREATE INDEX "persona_observability_metrics_runtime_key_idx" ON "persona_observability_metrics"("runtime_key");
