/*
  Warnings:

  - You are about to drop the column `meta_json` on the `aftershow_artifacts` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `aftershow_callouts` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `aftershow_runs` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `agent_achievements` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `agent_signal_logs` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `audience_summaries` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `chronicle_entries` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `community_config_patches` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `community_config_versions` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `community_merge_recommendations` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `community_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `t4_candidate` on the `community_proposals` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `incubation_grants` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `incubation_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `strict_t4` on the `incubation_jobs` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `incubation_source_bundles` table. All the data in the column will be lost.
  - You are about to drop the column `metadata_json` on the `media_lineage_edges` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `moderation_case_targets` table. All the data in the column will be lost.
  - You are about to drop the column `moderation_metadata_json` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `moderation_metadata_json` on the `private_messages` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `role_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `moderation_metadata_json` on the `room_messages` table. All the data in the column will be lost.
  - You are about to drop the column `meta_json` on the `user_identity_verifications` table. All the data in the column will be lost.
  - You are about to drop the column `is_t4` on the `viewer_public_view_events` table. All the data in the column will be lost.
  - You are about to drop the `agent_inclination_assets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `legacy_growth_events_archive` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "agent_inclination_assets" DROP CONSTRAINT "agent_inclination_assets_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_inclination_assets" DROP CONSTRAINT "agent_inclination_assets_consumed_post_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_inclination_assets" DROP CONSTRAINT "agent_inclination_assets_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "community_merge_recommendations" DROP CONSTRAINT "community_merge_recommendations_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "community_proposal_events" DROP CONSTRAINT "community_proposal_events_proposal_id_fkey";

-- DropForeignKey
ALTER TABLE "legacy_growth_events_archive" DROP CONSTRAINT "legacy_growth_events_archive_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "public_stage_threads" DROP CONSTRAINT "public_stage_threads_author_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "public_stage_turns" DROP CONSTRAINT "public_stage_turns_author_agent_id_fkey";

-- AlterTable
ALTER TABLE "aftershow_artifacts" DROP COLUMN "meta_json",
ADD COLUMN     "publish_shape" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "threshold_pass" BOOLEAN;

-- AlterTable
ALTER TABLE "aftershow_callouts" DROP COLUMN "meta_json";

-- AlterTable
ALTER TABLE "aftershow_runs" DROP COLUMN "meta_json",
ADD COLUMN     "force_trigger" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "stage_spec_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "threshold_pass" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trigger_mode" TEXT,
ADD COLUMN     "used_stage_fallback" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "agent_achievements" DROP COLUMN "meta_json",
ADD COLUMN     "action" TEXT,
ADD COLUMN     "admin_user_id" TEXT,
ADD COLUMN     "artifact_id" TEXT,
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "evidence_satisfied" BOOLEAN,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "human_message_id" TEXT,
ADD COLUMN     "metric_name" TEXT,
ADD COLUMN     "metric_threshold" DOUBLE PRECISION,
ADD COLUMN     "metric_value" DOUBLE PRECISION,
ADD COLUMN     "new_state" TEXT,
ADD COLUMN     "new_visibility" TEXT,
ADD COLUMN     "next_state" TEXT,
ADD COLUMN     "opening_message_id" TEXT,
ADD COLUMN     "peer_agent_id" TEXT,
ADD COLUMN     "post_id" TEXT,
ADD COLUMN     "previous_state" TEXT,
ADD COLUMN     "publish_shape" TEXT,
ADD COLUMN     "result_success" BOOLEAN,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "shelf_id" TEXT,
ADD COLUMN     "signal_visibility_reason" TEXT,
ADD COLUMN     "snapshot_date" TEXT,
ADD COLUMN     "source_dedup_key" TEXT,
ADD COLUMN     "source_event_id" TEXT,
ADD COLUMN     "source_mode" TEXT,
ADD COLUMN     "source_ref" TEXT,
ADD COLUMN     "storyline_id" TEXT,
ADD COLUMN     "target_type" TEXT,
ADD COLUMN     "thread_id" TEXT,
ADD COLUMN     "to_agent_id" TEXT,
ADD COLUMN     "trigger_kind" TEXT,
ADD COLUMN     "trigger_mode" TEXT,
ADD COLUMN     "visibility_reason" TEXT;

-- AlterTable
ALTER TABLE "agent_signal_logs" DROP COLUMN "meta_json",
ADD COLUMN     "action" TEXT,
ADD COLUMN     "admin_user_id" TEXT,
ADD COLUMN     "artifact_id" TEXT,
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "human_message_id" TEXT,
ADD COLUMN     "new_state" TEXT,
ADD COLUMN     "new_visibility" TEXT,
ADD COLUMN     "next_state" TEXT,
ADD COLUMN     "opening_message_id" TEXT,
ADD COLUMN     "peer_agent_id" TEXT,
ADD COLUMN     "post_id" TEXT,
ADD COLUMN     "previous_state" TEXT,
ADD COLUMN     "publish_shape" TEXT,
ADD COLUMN     "result_success" BOOLEAN,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'global',
ADD COLUMN     "scope_key" TEXT NOT NULL DEFAULT '__global__',
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "shelf_id" TEXT,
ADD COLUMN     "signal_visibility_reason" TEXT,
ADD COLUMN     "snapshot_date" TEXT,
ADD COLUMN     "source_event_id" TEXT,
ADD COLUMN     "source_mode" TEXT,
ADD COLUMN     "source_ref" TEXT,
ADD COLUMN     "storyline_id" TEXT,
ADD COLUMN     "target_type" TEXT,
ADD COLUMN     "thread_id" TEXT,
ADD COLUMN     "to_agent_id" TEXT;

-- AlterTable
ALTER TABLE "audience_summaries" DROP COLUMN "meta_json",
ADD COLUMN     "safe_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "auth_verification_challenges" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chronicle_entries" DROP COLUMN "meta_json",
ADD COLUMN     "action" TEXT,
ADD COLUMN     "admin_user_id" TEXT,
ADD COLUMN     "artifact_id" TEXT,
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "emotion_after" TEXT,
ADD COLUMN     "emotion_before" TEXT,
ADD COLUMN     "entry_source" TEXT,
ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "human_message_id" TEXT,
ADD COLUMN     "new_state" TEXT,
ADD COLUMN     "new_visibility" TEXT,
ADD COLUMN     "next_hook" TEXT,
ADD COLUMN     "next_state" TEXT,
ADD COLUMN     "opening_message_id" TEXT,
ADD COLUMN     "outcome_sentence" TEXT,
ADD COLUMN     "peer_agent_id" TEXT,
ADD COLUMN     "post_id" TEXT,
ADD COLUMN     "previous_state" TEXT,
ADD COLUMN     "publish_shape" TEXT,
ADD COLUMN     "reaction_sentence" TEXT,
ADD COLUMN     "result_success" BOOLEAN,
ADD COLUMN     "scene_label" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'global',
ADD COLUMN     "scope_key" TEXT NOT NULL DEFAULT '__global__',
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "shelf_id" TEXT,
ADD COLUMN     "signal_visibility_reason" TEXT,
ADD COLUMN     "snapshot_date" TEXT,
ADD COLUMN     "source_event_id" TEXT,
ADD COLUMN     "source_event_ids_json" JSONB,
ADD COLUMN     "source_mode" TEXT,
ADD COLUMN     "source_ref" TEXT,
ADD COLUMN     "storyline_id" TEXT,
ADD COLUMN     "target_type" TEXT,
ADD COLUMN     "thread_id" TEXT,
ADD COLUMN     "to_agent_id" TEXT;

-- AlterTable
ALTER TABLE "community_config_patches" DROP COLUMN "meta_json",
ADD COLUMN     "applied_version_number" INTEGER,
ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_by_user_id" TEXT,
ADD COLUMN     "scheduler_last_error" TEXT,
ADD COLUMN     "scheduler_last_error_at" TIMESTAMP(3),
ADD COLUMN     "scheduler_next_retry_at" TIMESTAMP(3),
ADD COLUMN     "scheduler_retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduler_retry_exhausted_at" TIMESTAMP(3),
ADD COLUMN     "validation_failed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_config_versions" DROP COLUMN "meta_json",
ADD COLUMN     "applied_by_actor_id" TEXT,
ADD COLUMN     "rollback_reason" TEXT,
ADD COLUMN     "seed_key" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "community_merge_recommendations" DROP COLUMN "meta_json",
ADD COLUMN     "basis" TEXT,
ADD COLUMN     "best_match_slug" TEXT,
ADD COLUMN     "community_family_bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gray_visibility_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lane_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "merge_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "publication_profile_bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "scene_overlap" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "text_overlap" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_proposals" DROP COLUMN "meta_json",
DROP COLUMN "t4_candidate",
ADD COLUMN     "last_action" TEXT,
ADD COLUMN     "last_action_reason" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "incubation_grants" DROP COLUMN "meta_json";

-- AlterTable
ALTER TABLE "incubation_jobs" DROP COLUMN "meta_json",
DROP COLUMN "strict_t4",
ADD COLUMN     "job_source" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "published_post_id" TEXT,
ADD COLUMN     "review_reason" TEXT,
ADD COLUMN     "review_verdict" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_user_id" TEXT,
ADD COLUMN     "stage_spec_fallback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strict_publication" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "incubation_source_bundles" DROP COLUMN "meta_json",
ADD COLUMN     "source_memory_id" TEXT,
ADD COLUMN     "source_session_id" TEXT;

-- AlterTable
ALTER TABLE "invite_codes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "media_lineage_edges" DROP COLUMN "metadata_json",
ADD COLUMN     "binding_role" TEXT,
ADD COLUMN     "display_variant" TEXT,
ADD COLUMN     "extraction_status" TEXT,
ADD COLUMN     "generation_mode" TEXT,
ADD COLUMN     "input_mode" TEXT,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "post_id" TEXT,
ADD COLUMN     "projection_kind" TEXT,
ADD COLUMN     "projection_surface" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "reuse_mode" TEXT,
ADD COLUMN     "scene_id" TEXT,
ADD COLUMN     "scene_type" TEXT,
ADD COLUMN     "schema_version" TEXT,
ADD COLUMN     "selection_reason" TEXT,
ADD COLUMN     "source_kind" TEXT,
ADD COLUMN     "source_scene_id" TEXT,
ADD COLUMN     "source_scene_type" TEXT,
ADD COLUMN     "surface" TEXT,
ADD COLUMN     "visibility_policy" TEXT;

-- AlterTable
ALTER TABLE "moderation_case_targets" DROP COLUMN "meta_json";

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "moderation_metadata_json",
ADD COLUMN     "admin_distribution_override_json" JSONB,
ADD COLUMN     "forum_orchestration_override_json" JSONB,
ADD COLUMN     "moderation_distribution_state" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "moderation_kill_switch_json" JSONB,
ADD COLUMN     "moderation_policy_action" TEXT,
ADD COLUMN     "moderation_policy_case_id" TEXT,
ADD COLUMN     "moderation_policy_reason" TEXT,
ADD COLUMN     "moderation_topic_signals_json" JSONB,
ADD COLUMN     "participation_contract_override_json" JSONB,
ADD COLUMN     "stage_runtime_role" TEXT,
ADD COLUMN     "stage_runtime_tier" TEXT,
ADD COLUMN     "stage_spec_fallback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trust_context_json" JSONB;

-- AlterTable
ALTER TABLE "private_messages" DROP COLUMN "moderation_metadata_json",
ADD COLUMN     "moderation_distribution_state" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "moderation_hot_topic_json" JSONB,
ADD COLUMN     "moderation_kill_switch_json" JSONB,
ADD COLUMN     "moderation_policy_action" TEXT,
ADD COLUMN     "moderation_policy_enforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_policy_shadowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_result_json" JSONB,
ADD COLUMN     "moderation_rewrite_cause" TEXT,
ADD COLUMN     "moderation_room_no_recommend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_spillover_json" JSONB,
ADD COLUMN     "moderation_topic_signals_json" JSONB,
ADD COLUMN     "runtime_failure_message" TEXT;

-- AlterTable
ALTER TABLE "role_assignments" DROP COLUMN "meta_json",
ADD COLUMN     "last_action_reason" TEXT;

-- AlterTable
ALTER TABLE "room_messages" DROP COLUMN "moderation_metadata_json",
ADD COLUMN     "governance_action" TEXT,
ADD COLUMN     "governance_reason" TEXT,
ADD COLUMN     "governance_updated_at" TIMESTAMP(3),
ADD COLUMN     "moderation_distribution_state" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "moderation_hot_topic_json" JSONB,
ADD COLUMN     "moderation_kill_switch_json" JSONB,
ADD COLUMN     "moderation_policy_action" TEXT,
ADD COLUMN     "moderation_policy_enforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_policy_shadowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_result_json" JSONB,
ADD COLUMN     "moderation_rewrite_cause" TEXT,
ADD COLUMN     "moderation_room_no_recommend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_spillover_json" JSONB,
ADD COLUMN     "moderation_topic_signals_json" JSONB;

-- AlterTable
ALTER TABLE "user_identity_verifications" DROP COLUMN "meta_json";

-- AlterTable
ALTER TABLE "viewer_public_view_events" DROP COLUMN "is_t4",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "agent_inclination_assets";

-- DropTable
DROP TABLE "legacy_growth_events_archive";

-- DropEnum
DROP TYPE "InclinationAssetStatus";

-- DropEnum
DROP TYPE "InclinationSourceType";

-- CreateIndex
CREATE INDEX "agent_signal_logs_agent_id_scope_scope_key_occurred_at_idx" ON "agent_signal_logs"("agent_id", "scope", "scope_key", "occurred_at");

-- CreateIndex
CREATE INDEX "chronicle_entries_agent_id_scope_scope_key_occurred_at_idx" ON "chronicle_entries"("agent_id", "scope", "scope_key", "occurred_at");

-- RenameForeignKey
ALTER TABLE "community_merge_recommendations" RENAME CONSTRAINT "community_merge_recommendations_recommended_as_lane_community_i" TO "community_merge_recommendations_recommended_as_lane_commun_fkey";

-- AddForeignKey
ALTER TABLE "public_stage_threads" ADD CONSTRAINT "public_stage_threads_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_stage_turns" ADD CONSTRAINT "public_stage_turns_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_merge_recommendations" ADD CONSTRAINT "community_merge_recommendations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "community_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_proposal_events" ADD CONSTRAINT "community_proposal_events_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "community_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "community_merge_recommendations_recommended_as_lane_community_i" RENAME TO "community_merge_recommendations_recommended_as_lane_communi_idx";

-- RenameIndex
ALTER INDEX "viewer_public_view_events_source_surface_source_shelf_occurred_" RENAME TO "viewer_public_view_events_source_surface_source_shelf_occur_idx";
