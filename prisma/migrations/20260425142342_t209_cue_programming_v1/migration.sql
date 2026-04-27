-- T-209 cue-data-and-board: introduces the public discussion cue
-- programming layer. Adds 6 new tables, 19 enums, internal cue-domain
-- foreign keys; cross-domain references (community, asset, agent, post,
-- user) are plain string columns without ORM-level FKs to minimize blast
-- radius on existing models.
--
-- Note: an earlier auto-generated draft of this migration also contained
-- unrelated drift remediation (media_embedding_snapshots column type,
-- media_* updated_at default drops). That has been split into its own
-- migration `20260425150000_drift_cleanup_embedding_vector_and_updated_at`
-- so this migration stays purely cue-domain additive.

-- CreateEnum
CREATE TYPE "CueScopeType" AS ENUM ('GLOBAL', 'COMMUNITY', 'ROOM');

-- CreateEnum
CREATE TYPE "CueScheduleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ACTIVE', 'ARCHIVED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "CueScheduleSource" AS ENUM ('BASELINE', 'MANUAL', 'AUTOMATED', 'MIXED');

-- CreateEnum
CREATE TYPE "CueSourceType" AS ENUM ('MANUAL', 'AUTOMATED', 'BASELINE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PublicDiscussionCueStatus" AS ENUM ('DRAFT', 'VALIDATING', 'VALIDATED', 'SCHEDULED', 'PREWARMING', 'DUE', 'CLAIMED', 'EXECUTING', 'CONSUMED', 'DEFERRED', 'SKIPPED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CueLane" AS ENUM ('PRIME', 'STANDARD', 'BACKGROUND');

-- CreateEnum
CREATE TYPE "CueRiskLevel" AS ENUM ('LOW', 'STANDARD', 'HIGH', 'STRICT_REVIEW');

-- CreateEnum
CREATE TYPE "CueMediaRole" AS ENUM ('CONTEXT_ANCHOR', 'MOOD_REFERENCE', 'EVIDENCE_CARD', 'VISUAL_SEED', 'COVER_CANDIDATE', 'CONTINUITY_ANCHOR');

-- CreateEnum
CREATE TYPE "CueMediaUsageStrength" AS ENUM ('OPTIONAL', 'PREFERRED', 'ANCHOR', 'SELECTED_ONLY_POOL');

-- CreateEnum
CREATE TYPE "CueMediaUsePolicy" AS ENUM ('RUNTIME_ONLY', 'PREFER_RUNTIME_CONTEXT', 'PREFER_PUBLIC_DISPLAY', 'ALLOW_GENERATED_DERIVATIVE', 'REQUIRE_PUBLIC_DISPLAY');

-- CreateEnum
CREATE TYPE "CueMediaValidationStatus" AS ENUM ('VALID', 'INVALID', 'BLOCKED', 'DEGRADED');

-- CreateEnum
CREATE TYPE "CueMediaCreatedByType" AS ENUM ('ADMIN', 'SYSTEM_LLM', 'BASELINE');

-- CreateEnum
CREATE TYPE "CueChangeType" AS ENUM ('CREATE_CUE', 'UPDATE_CUE', 'CANCEL_CUE', 'DEFER_CUE', 'MERGE_INTO_EXISTING_CUE', 'SPLIT_CUE', 'ATTACH_MEDIA', 'REMOVE_MEDIA', 'UPDATE_DISPATCH_POLICY', 'UPDATE_RISK_LEVEL', 'PUBLISH_SCHEDULE', 'ROLLBACK_SCHEDULE');

-- CreateEnum
CREATE TYPE "CueChangeSource" AS ENUM ('MANUAL', 'AUTOMATED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CueChangeApprovalStatus" AS ENUM ('PENDING', 'AUTO_APPLIED', 'APPROVED', 'REJECTED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "CueChangeValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CueExecutionAttemptStatus" AS ENUM ('PENDING', 'ADMITTED', 'LEASED', 'ALLOCATING', 'COMPILING', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'DELAYED', 'MISFIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CueLoadState" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "CueLoadSnapshotFreshness" AS ENUM ('LIVE', 'CACHED');

-- CreateTable
CREATE TABLE "public_discussion_cue_schedules" (
    "id" TEXT NOT NULL,
    "scope_type" "CueScopeType" NOT NULL DEFAULT 'GLOBAL',
    "community_id" TEXT,
    "room_id" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "date_range_start" TIMESTAMP(3) NOT NULL,
    "date_range_end" TIMESTAMP(3) NOT NULL,
    "baseline_contract_version" TEXT,
    "status" "CueScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "CueScheduleSource" NOT NULL DEFAULT 'MANUAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "base_schedule_id" TEXT,
    "rollback_from_schedule_id" TEXT,
    "summary" TEXT,
    "created_by_user_id" TEXT,
    "created_by_system" TEXT,
    "published_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_discussion_cue_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_discussion_cues" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "source_type" "CueSourceType" NOT NULL,
    "status" "PublicDiscussionCueStatus" NOT NULL DEFAULT 'DRAFT',
    "community_id" TEXT,
    "scope_json" JSONB NOT NULL DEFAULT '{}',
    "trigger_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "prewarm_at" TIMESTAMP(3),
    "latest_start_at" TIMESTAMP(3),
    "expire_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 50,
    "lane" "CueLane" NOT NULL DEFAULT 'STANDARD',
    "dispatch_policy_json" JSONB NOT NULL,
    "admission_policy_json" JSONB,
    "load_policy_json" JSONB,
    "theme_intent_json" JSONB NOT NULL,
    "scene_constraints_json" JSONB NOT NULL,
    "role_requirements_json" JSONB NOT NULL,
    "media_policy_json" JSONB,
    "safety_json" JSONB,
    "locked_fields_json" JSONB NOT NULL DEFAULT '[]',
    "risk_level" "CueRiskLevel" NOT NULL DEFAULT 'STANDARD',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_by_system" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_discussion_cues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_discussion_cue_media" (
    "id" TEXT NOT NULL,
    "cue_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "semantic_snapshot_id" TEXT,
    "role" "CueMediaRole" NOT NULL,
    "usage_strength" "CueMediaUsageStrength" NOT NULL DEFAULT 'OPTIONAL',
    "use_policy" "CueMediaUsePolicy" NOT NULL DEFAULT 'PREFER_RUNTIME_CONTEXT',
    "display_policy" TEXT NOT NULL DEFAULT 'runtime_decides',
    "selection_note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "reuse_limit" INTEGER,
    "validation_status" "CueMediaValidationStatus" NOT NULL DEFAULT 'VALID',
    "validation_reason" TEXT,
    "created_by_type" "CueMediaCreatedByType" NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_discussion_cue_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_discussion_cue_changes" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "cue_id" TEXT,
    "source" "CueChangeSource" NOT NULL,
    "actor_user_id" TEXT,
    "actor_system" TEXT,
    "trigger_id" TEXT,
    "trigger_type" TEXT,
    "change_type" "CueChangeType" NOT NULL,
    "base_revision" INTEGER,
    "patch_json" JSONB NOT NULL,
    "diff_json" JSONB,
    "validation_status" "CueChangeValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validation_json" JSONB,
    "risk_level" "CueRiskLevel" NOT NULL DEFAULT 'STANDARD',
    "approval_status" "CueChangeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "load_snapshot_json" JSONB,
    "reason" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_discussion_cue_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cue_execution_attempts" (
    "id" TEXT NOT NULL,
    "cue_id" TEXT NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "scheduled_trigger_at" TIMESTAMP(3) NOT NULL,
    "actual_claimed_at" TIMESTAMP(3),
    "status" "CueExecutionAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "admission_result_json" JSONB,
    "allocator_result_json" JSONB,
    "director_brief_json" JSONB,
    "compiled_payload_ref" TEXT,
    "selected_cast_json" JSONB,
    "selected_agent_ids_json" JSONB,
    "post_id" TEXT,
    "thread_id" TEXT,
    "turn_id" TEXT,
    "room_id" TEXT,
    "room_program_event_id" TEXT,
    "agent_run_id" TEXT,
    "forum_scene_metadata_id" TEXT,
    "episode_id" TEXT,
    "selection_id" TEXT,
    "episode_plan_id" TEXT,
    "local_intent_id" TEXT,
    "overlay_id" TEXT,
    "director_surface" TEXT,
    "actor_surface" TEXT,
    "media_usage_json" JSONB,
    "display_attribution_json" JSONB,
    "consumption_result_json" JSONB,
    "moderation_result_json" JSONB,
    "load_snapshot_json" JSONB,
    "queue_latency_ms" INTEGER,
    "admission_latency_ms" INTEGER,
    "allocator_latency_ms" INTEGER,
    "compile_latency_ms" INTEGER,
    "llm_latency_ms" INTEGER,
    "write_latency_ms" INTEGER,
    "total_latency_ms" INTEGER,
    "error_code" TEXT,
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "cue_execution_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_runtime_load_snapshots" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "freshness" "CueLoadSnapshotFreshness" NOT NULL DEFAULT 'CACHED',
    "state" "CueLoadState" NOT NULL DEFAULT 'GREEN',
    "global_state" "CueLoadState" NOT NULL DEFAULT 'GREEN',
    "scheduled_cue_count" INTEGER NOT NULL DEFAULT 0,
    "due_cue_count" INTEGER NOT NULL DEFAULT 0,
    "executing_cue_count" INTEGER NOT NULL DEFAULT 0,
    "recent_root_post_count" INTEGER NOT NULL DEFAULT 0,
    "recent_thread_followup_count" INTEGER NOT NULL DEFAULT 0,
    "active_scene_count" INTEGER NOT NULL DEFAULT 0,
    "hot_thread_pressure" DOUBLE PRECISION,
    "visible_llm_queue_depth" INTEGER,
    "media_queue_depth" INTEGER,
    "provider_queue_pressure" DOUBLE PRECISION,
    "load_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacity_remaining" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_runtime_load_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_discussion_cue_schedules_status_date_range_start_idx" ON "public_discussion_cue_schedules"("status", "date_range_start");

-- CreateIndex
CREATE INDEX "public_discussion_cue_schedules_community_id_status_idx" ON "public_discussion_cue_schedules"("community_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "public_discussion_cues_idempotency_key_key" ON "public_discussion_cues"("idempotency_key");

-- CreateIndex
CREATE INDEX "public_discussion_cues_schedule_id_status_idx" ON "public_discussion_cues"("schedule_id", "status");

-- CreateIndex
CREATE INDEX "public_discussion_cues_status_trigger_at_idx" ON "public_discussion_cues"("status", "trigger_at");

-- CreateIndex
CREATE INDEX "public_discussion_cues_community_id_trigger_at_idx" ON "public_discussion_cues"("community_id", "trigger_at");

-- CreateIndex
CREATE INDEX "public_discussion_cue_media_cue_id_sort_order_idx" ON "public_discussion_cue_media"("cue_id", "sort_order");

-- CreateIndex
CREATE INDEX "public_discussion_cue_media_asset_id_idx" ON "public_discussion_cue_media"("asset_id");

-- CreateIndex
CREATE INDEX "public_discussion_cue_changes_cue_id_created_at_idx" ON "public_discussion_cue_changes"("cue_id", "created_at");

-- CreateIndex
CREATE INDEX "public_discussion_cue_changes_schedule_id_created_at_idx" ON "public_discussion_cue_changes"("schedule_id", "created_at");

-- CreateIndex
CREATE INDEX "public_discussion_cue_changes_approval_status_created_at_idx" ON "public_discussion_cue_changes"("approval_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cue_execution_attempts_idempotency_key_key" ON "cue_execution_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "cue_execution_attempts_cue_id_status_idx" ON "cue_execution_attempts"("cue_id", "status");

-- CreateIndex
CREATE INDEX "cue_execution_attempts_status_scheduled_trigger_at_idx" ON "cue_execution_attempts"("status", "scheduled_trigger_at");

-- CreateIndex
CREATE INDEX "cue_execution_attempts_lease_owner_lease_expires_at_idx" ON "cue_execution_attempts"("lease_owner", "lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "cue_execution_attempts_cue_id_attempt_no_key" ON "cue_execution_attempts"("cue_id", "attempt_no");

-- CreateIndex
CREATE INDEX "community_runtime_load_snapshots_community_id_computed_at_idx" ON "community_runtime_load_snapshots"("community_id", "computed_at");

-- CreateIndex
CREATE INDEX "community_runtime_load_snapshots_freshness_computed_at_idx" ON "community_runtime_load_snapshots"("freshness", "computed_at");

-- AddForeignKey
ALTER TABLE "public_discussion_cues" ADD CONSTRAINT "public_discussion_cues_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public_discussion_cue_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_discussion_cue_media" ADD CONSTRAINT "public_discussion_cue_media_cue_id_fkey" FOREIGN KEY ("cue_id") REFERENCES "public_discussion_cues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_discussion_cue_changes" ADD CONSTRAINT "public_discussion_cue_changes_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public_discussion_cue_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_discussion_cue_changes" ADD CONSTRAINT "public_discussion_cue_changes_cue_id_fkey" FOREIGN KEY ("cue_id") REFERENCES "public_discussion_cues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cue_execution_attempts" ADD CONSTRAINT "cue_execution_attempts_cue_id_fkey" FOREIGN KEY ("cue_id") REFERENCES "public_discussion_cues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "media_embedding_snapshots_index_profile_id_search_status_create" RENAME TO "media_embedding_snapshots_index_profile_id_search_status_cr_idx";

-- RenameIndex
ALTER INDEX "media_embedding_snapshots_retrieval_document_id_index_profile_i" RENAME TO "media_embedding_snapshots_retrieval_document_id_index_profi_idx";

-- RenameIndex
ALTER INDEX "media_import_jobs_requested_by_type_requested_by_id_created_at_" RENAME TO "media_import_jobs_requested_by_type_requested_by_id_created_idx";

-- RenameIndex
ALTER INDEX "media_retrieval_documents_duplicate_cluster_id_is_canonical_cre" RENAME TO "media_retrieval_documents_duplicate_cluster_id_is_canonical_idx";

-- RenameIndex
ALTER INDEX "media_retrieval_documents_owner_user_id_doc_scope_created_at_id" RENAME TO "media_retrieval_documents_owner_user_id_doc_scope_created_a_idx";
