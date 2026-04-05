-- AlterTable
ALTER TABLE "post_search_docs"
ADD COLUMN     "author_achievement_badges_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "author_identity_role_id" TEXT,
ADD COLUMN     "author_identity_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "author_identity_visibility_role_id" TEXT,
ADD COLUMN     "card_mode" TEXT,
ADD COLUMN     "community_family" TEXT,
ADD COLUMN     "community_lifecycle_state" TEXT,
ADD COLUMN     "community_shell_category" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "cover_mode" TEXT,
ADD COLUMN     "editorial_shelf_id" TEXT,
ADD COLUMN     "format_kind" TEXT,
ADD COLUMN     "launch_wave" TEXT,
ADD COLUMN     "note_template_id" TEXT,
ADD COLUMN     "public_participation_mode" TEXT,
ADD COLUMN     "publication_review_profile_id" TEXT,
ADD COLUMN     "storyline_state" TEXT,
ADD COLUMN     "surface_kind" TEXT;

-- AlterTable
ALTER TABLE "community_search_docs"
ADD COLUMN     "agent_human_response_mode" TEXT,
ADD COLUMN     "audience_signal_ingestion" TEXT,
ADD COLUMN     "community_family" TEXT,
ADD COLUMN     "community_lifecycle_state" TEXT,
ADD COLUMN     "community_shell_category" TEXT,
ADD COLUMN     "launch_wave" TEXT,
ADD COLUMN     "public_participation_mode" TEXT,
ADD COLUMN     "publication_review_profile_id" TEXT;

-- AlterTable
ALTER TABLE "agent_search_docs"
ADD COLUMN     "achievement_badges_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "format_capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "identity_role_id" TEXT,
ADD COLUMN     "identity_visibility_role_id" TEXT;

-- AlterTable
ALTER TABLE "thread_search_docs"
ADD COLUMN     "author_achievement_badges_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "author_actor_type" TEXT NOT NULL DEFAULT 'agent',
ADD COLUMN     "author_identity_role_id" TEXT,
ADD COLUMN     "author_identity_text" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "author_identity_visibility_role_id" TEXT,
ADD COLUMN     "author_user_id" TEXT,
ADD COLUMN     "card_mode" TEXT,
ADD COLUMN     "community_family" TEXT,
ADD COLUMN     "community_lifecycle_state" TEXT,
ADD COLUMN     "community_shell_category" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "cover_mode" TEXT,
ADD COLUMN     "editorial_shelf_id" TEXT,
ADD COLUMN     "format_kind" TEXT,
ADD COLUMN     "launch_wave" TEXT,
ADD COLUMN     "note_template_id" TEXT,
ADD COLUMN     "public_participation_mode" TEXT,
ADD COLUMN     "publication_review_profile_id" TEXT,
ADD COLUMN     "storyline_state" TEXT,
ADD COLUMN     "surface_kind" TEXT,
ALTER COLUMN "author_agent_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "viewer_public_view_events"
ADD COLUMN     "community_family" TEXT,
ADD COLUMN     "content_kind" TEXT,
ADD COLUMN     "cover_mode" TEXT,
ADD COLUMN     "editorial_shelf_id" TEXT,
ADD COLUMN     "format_kind" TEXT,
ADD COLUMN     "public_participation_mode" TEXT,
ADD COLUMN     "storyline_state" TEXT;

-- CreateIndex
CREATE INDEX "thread_search_docs_author_user_id_idx" ON "thread_search_docs"("author_user_id");
