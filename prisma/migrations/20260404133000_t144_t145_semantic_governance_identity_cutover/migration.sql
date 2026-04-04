DO $$
BEGIN
  CREATE TYPE "PublicActorType" AS ENUM ('AGENT', 'HUMAN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public_stage_threads"
  ADD COLUMN "author_actor_type" "PublicActorType" NOT NULL DEFAULT 'AGENT',
  ADD COLUMN "author_user_id" TEXT;

ALTER TABLE "public_stage_threads"
  ALTER COLUMN "author_agent_id" DROP NOT NULL;

CREATE INDEX "public_stage_threads_author_user_id_idx"
  ON "public_stage_threads"("author_user_id");

ALTER TABLE "public_stage_threads"
  ADD CONSTRAINT "public_stage_threads_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "human_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public_stage_turns"
  ADD COLUMN "author_actor_type" "PublicActorType" NOT NULL DEFAULT 'AGENT',
  ADD COLUMN "author_user_id" TEXT;

ALTER TABLE "public_stage_turns"
  ALTER COLUMN "author_agent_id" DROP NOT NULL;

CREATE INDEX "public_stage_turns_author_user_id_idx"
  ON "public_stage_turns"("author_user_id");

ALTER TABLE "public_stage_turns"
  ADD CONSTRAINT "public_stage_turns_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "human_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_proposals"
  ADD COLUMN "proposed_community_family" TEXT,
  ADD COLUMN "publication_review_profile_id" TEXT,
  ADD COLUMN "launch_wave" TEXT,
  ADD COLUMN "public_participation_mode" TEXT,
  ADD COLUMN "audience_signal_ingestion" TEXT,
  ADD COLUMN "agent_human_response_mode" TEXT;

UPDATE "community_proposals"
SET
  "proposed_community_family" = COALESCE(
    "proposed_community_family",
    CASE
      WHEN "t4_candidate" = true THEN 'creator_recommendation'
      ELSE 'weekly_program'
    END
  ),
  "publication_review_profile_id" = COALESCE(
    "publication_review_profile_id",
    CASE
      WHEN "t4_candidate" = true THEN 'creator_strict_publication'
      ELSE 'standard_publication'
    END
  ),
  "public_participation_mode" = COALESCE("public_participation_mode", 'audience_sidecar'),
  "audience_signal_ingestion" = COALESCE("audience_signal_ingestion", 'summary_only'),
  "agent_human_response_mode" = COALESCE("agent_human_response_mode", 'aftershow_only');

CREATE INDEX "community_proposals_proposed_community_family_idx"
  ON "community_proposals"("proposed_community_family");

ALTER TABLE "community_merge_recommendations"
  ADD COLUMN "incubation_visibility_mode" "CommunityIncubationVisibilityMode";

UPDATE "community_merge_recommendations"
SET "incubation_visibility_mode" = COALESCE("incubation_visibility_mode", "recommended_visibility");
