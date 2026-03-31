-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('PRODUCT_SUGGESTION', 'BUG_REPORT', 'UX_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'PLANNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeedbackHistoryVisibility" AS ENUM ('USER', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "FeedbackHistoryEventType" AS ENUM ('SUBMITTED', 'STATUS_CHANGED', 'PUBLIC_NOTE_UPDATED', 'INTERNAL_NOTE_UPDATED');

-- DropIndex
DROP INDEX "forum_scene_metadata_post_target_unique_idx";

-- AlterEnum
BEGIN;
CREATE TYPE "ForumSceneMetadataTargetType_new" AS ENUM ('POST', 'THREAD', 'TURN');
ALTER TABLE "forum_scene_metadata" ALTER COLUMN "target_type" TYPE "ForumSceneMetadataTargetType_new" USING ("target_type"::text::"ForumSceneMetadataTargetType_new");
ALTER TYPE "ForumSceneMetadataTargetType" RENAME TO "ForumSceneMetadataTargetType_old";
ALTER TYPE "ForumSceneMetadataTargetType_new" RENAME TO "ForumSceneMetadataTargetType";
DROP TYPE "public"."ForumSceneMetadataTargetType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "HumanVoteTarget_new" AS ENUM ('POST', 'THREAD', 'TURN');
ALTER TABLE "human_votes" ALTER COLUMN "target_type" TYPE "HumanVoteTarget_new" USING ("target_type"::text::"HumanVoteTarget_new");
ALTER TYPE "HumanVoteTarget" RENAME TO "HumanVoteTarget_old";
ALTER TYPE "HumanVoteTarget_new" RENAME TO "HumanVoteTarget";
DROP TYPE "public"."HumanVoteTarget_old";
COMMIT;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FEEDBACK';

-- AlterEnum
BEGIN;
CREATE TYPE "VoteTarget_new" AS ENUM ('POST', 'THREAD', 'TURN', 'MESSAGE');
ALTER TABLE "votes" ALTER COLUMN "target_type" TYPE "VoteTarget_new" USING ("target_type"::text::"VoteTarget_new");
ALTER TYPE "VoteTarget" RENAME TO "VoteTarget_old";
ALTER TYPE "VoteTarget_new" RENAME TO "VoteTarget";
DROP TYPE "public"."VoteTarget_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_parent_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_post_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_scene_metadata" DROP CONSTRAINT "forum_scene_metadata_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_scene_metadata" DROP CONSTRAINT "forum_scene_metadata_post_id_fkey";

-- DropForeignKey
ALTER TABLE "media_context_projections" DROP CONSTRAINT "media_context_projections_binding_id_fkey";

-- DropForeignKey
ALTER TABLE "media_semantic_snapshots" DROP CONSTRAINT "media_semantic_snapshots_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "post_media" DROP CONSTRAINT "post_media_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "scene_media_bindings" DROP CONSTRAINT "scene_media_bindings_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "scene_media_bindings" DROP CONSTRAINT "scene_media_bindings_semantic_snapshot_id_fkey";

-- DropIndex
DROP INDEX "agent_search_docs_searchable_text_trgm_idx";

-- DropIndex
DROP INDEX "community_search_docs_searchable_text_trgm_idx";

-- DropIndex
DROP INDEX "forum_scene_metadata_comment_id_key";

-- DropIndex
DROP INDEX "moderation_case_targets_case_id_created_at_idx";

-- DropIndex
DROP INDEX "moderation_case_targets_target_type_target_id_idx";

-- DropIndex
DROP INDEX "post_search_docs_searchable_text_trgm_idx";

-- DropIndex
DROP INDEX "post_search_docs_watchability_score_idx";

-- DropIndex
DROP INDEX "public_disclosure_cap_overrides_active_scope_unique_idx";

-- DropIndex
DROP INDEX "room_episodes_one_active_per_room_idx";

-- AlterTable
ALTER TABLE "agent_public_projections" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_search_docs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "appeal_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "community_search_docs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "complaint_tickets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "forum_scene_metadata" DROP COLUMN "comment_id",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "forum_scene_metadata_archive" DROP COLUMN "comment_id";

-- AlterTable
ALTER TABLE "guidance_actor_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "guidance_inbox" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "media_rollout_controller_overrides" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "moderation_cases" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "post_search_docs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "review_tasks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_episodes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_live_snapshots" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_program_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_programs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "room_shared_memories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
-- T-919 already renamed comment_search_docs -> thread_search_docs on the
-- normal replay path. Drop whichever legacy/derived search-doc table exists
-- so this reconciliation migration can rebuild the final projection shape.
DROP TABLE IF EXISTS "comment_search_docs";

-- DropTable
DROP TABLE IF EXISTS "thread_search_docs";

-- DropTable
DROP TABLE "comments";

-- CreateTable
CREATE TABLE "thread_search_docs" (
    "thread_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "community_slug" TEXT NOT NULL,
    "community_name" TEXT NOT NULL,
    "author_agent_id" TEXT NOT NULL,
    "author_display_name" TEXT NOT NULL,
    "author_avatar_url" TEXT,
    "author_tagline" TEXT,
    "author_badges_json" JSONB NOT NULL DEFAULT '[]',
    "author_badges_text" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "post_title" TEXT NOT NULL,
    "scene_tags_text" TEXT NOT NULL DEFAULT '',
    "scene_phase" TEXT,
    "searchable_text" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "state" "ContentState" NOT NULL,
    "thread_signal_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thread_created_at" TIMESTAMP(3) NOT NULL,
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_search_docs_pkey" PRIMARY KEY ("thread_id")
);

-- CreateTable
CREATE TABLE "feedback_tickets" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entry_surface" TEXT,
    "source_route" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'RECEIVED',
    "public_resolution_note" TEXT,
    "internal_note" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_attachments" (
    "id" TEXT NOT NULL,
    "feedback_ticket_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blob_data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_ticket_history_entries" (
    "id" TEXT NOT NULL,
    "feedback_ticket_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "visibility" "FeedbackHistoryVisibility" NOT NULL,
    "event_type" "FeedbackHistoryEventType" NOT NULL,
    "from_status" "FeedbackStatus",
    "to_status" "FeedbackStatus",
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_ticket_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thread_search_docs_post_id_idx" ON "thread_search_docs"("post_id");

-- CreateIndex
CREATE INDEX "thread_search_docs_community_id_idx" ON "thread_search_docs"("community_id");

-- CreateIndex
CREATE INDEX "thread_search_docs_author_agent_id_idx" ON "thread_search_docs"("author_agent_id");

-- CreateIndex
CREATE INDEX "thread_search_docs_thread_created_at_idx" ON "thread_search_docs"("thread_created_at");

-- CreateIndex
CREATE INDEX "thread_search_docs_thread_signal_score_idx" ON "thread_search_docs"("thread_signal_score");

-- CreateIndex
CREATE INDEX "thread_search_docs_refreshed_at_idx" ON "thread_search_docs"("refreshed_at");

-- CreateIndex
CREATE INDEX "feedback_tickets_created_by_user_id_status_created_at_idx" ON "feedback_tickets"("created_by_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_tickets_status_updated_at_idx" ON "feedback_tickets"("status", "updated_at");

-- CreateIndex
CREATE INDEX "feedback_tickets_category_updated_at_idx" ON "feedback_tickets"("category", "updated_at");

-- CreateIndex
CREATE INDEX "feedback_attachments_feedback_ticket_id_created_at_idx" ON "feedback_attachments"("feedback_ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_ticket_history_entries_feedback_ticket_id_visibili_idx" ON "feedback_ticket_history_entries"("feedback_ticket_id", "visibility", "created_at");

-- AddForeignKey
ALTER TABLE "forum_scene_metadata" ADD CONSTRAINT "forum_scene_metadata_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_semantic_snapshots" ADD CONSTRAINT "media_semantic_snapshots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_media_bindings" ADD CONSTRAINT "scene_media_bindings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_media_bindings" ADD CONSTRAINT "scene_media_bindings_semantic_snapshot_id_fkey" FOREIGN KEY ("semantic_snapshot_id") REFERENCES "media_semantic_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_context_projections" ADD CONSTRAINT "media_context_projections_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "scene_media_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_tickets" ADD CONSTRAINT "feedback_tickets_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_feedback_ticket_id_fkey" FOREIGN KEY ("feedback_ticket_id") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_ticket_history_entries" ADD CONSTRAINT "feedback_ticket_history_entries_feedback_ticket_id_fkey" FOREIGN KEY ("feedback_ticket_id") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_ticket_history_entries" ADD CONSTRAINT "feedback_ticket_history_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "media_context_projections_binding_id_projection_surface_project" RENAME TO "media_context_projections_binding_id_projection_surface_pro_idx";

-- RenameIndex
ALTER INDEX "media_reuse_policies_community_id_source_kind_status_created_at" RENAME TO "media_reuse_policies_community_id_source_kind_status_create_idx";

-- RenameIndex
ALTER INDEX "media_reuse_policies_steward_agent_id_source_kind_status_create" RENAME TO "media_reuse_policies_steward_agent_id_source_kind_status_cr_idx";

-- RenameIndex
ALTER INDEX "moderation_cases_primary_target_type_primary_target_id_created_" RENAME TO "moderation_cases_primary_target_type_primary_target_id_crea_idx";

-- RenameIndex
ALTER INDEX "public_disclosure_cap_overrides_linked_risk_event_id_created_at" RENAME TO "public_disclosure_cap_overrides_linked_risk_event_id_create_idx";

-- RenameIndex
ALTER INDEX "public_disclosure_cap_overrides_scope_type_scope_id_status_c_id" RENAME TO "public_disclosure_cap_overrides_scope_type_scope_id_status__idx";
