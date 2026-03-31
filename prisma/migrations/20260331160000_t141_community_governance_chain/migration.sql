CREATE TYPE "CommunityProposalStatus" AS ENUM (
  'SUBMITTED',
  'REJECTED',
  'INCUBATING',
  'SEASONAL',
  'ACTIVATED',
  'MERGED',
  'ARCHIVED'
);

CREATE TYPE "CommunityIncubationVisibilityMode" AS ENUM (
  'GRAY',
  'WHITELIST_ONLY'
);

CREATE TYPE "CommunityProposalActorType" AS ENUM (
  'human',
  'system'
);

CREATE TABLE "community_proposals" (
  "id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug_candidate" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "premise_text" TEXT NOT NULL,
  "target_audience" TEXT,
  "scene_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "t4_candidate" BOOLEAN NOT NULL DEFAULT false,
  "source_community_id" TEXT,
  "status" "CommunityProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
  "incubation_visibility_mode" "CommunityIncubationVisibilityMode",
  "resulting_community_id" TEXT,
  "merged_into_community_id" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "meta_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_merge_recommendations" (
  "id" TEXT NOT NULL,
  "proposal_id" TEXT NOT NULL,
  "duplicate_of_community_id" TEXT,
  "recommended_as_lane_community_id" TEXT,
  "recommended_as_seasonal" BOOLEAN NOT NULL DEFAULT true,
  "recommended_visibility" "CommunityIncubationVisibilityMode" NOT NULL DEFAULT 'GRAY',
  "overlap_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rationale" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "meta_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_merge_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_proposal_events" (
  "id" TEXT NOT NULL,
  "proposal_id" TEXT NOT NULL,
  "actor_type" "CommunityProposalActorType" NOT NULL,
  "actor_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_proposal_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_proposals_status_created_at_idx"
  ON "community_proposals"("status", "created_at");

CREATE INDEX "community_proposals_submitted_by_user_id_created_at_idx"
  ON "community_proposals"("submitted_by_user_id", "created_at");

CREATE INDEX "community_proposals_slug_candidate_idx"
  ON "community_proposals"("slug_candidate");

CREATE INDEX "community_proposals_source_community_id_idx"
  ON "community_proposals"("source_community_id");

CREATE INDEX "community_proposals_resulting_community_id_idx"
  ON "community_proposals"("resulting_community_id");

CREATE INDEX "community_proposals_merged_into_community_id_idx"
  ON "community_proposals"("merged_into_community_id");

CREATE UNIQUE INDEX "community_merge_recommendations_proposal_id_key"
  ON "community_merge_recommendations"("proposal_id");

CREATE INDEX "community_merge_recommendations_duplicate_of_community_id_idx"
  ON "community_merge_recommendations"("duplicate_of_community_id");

CREATE INDEX "community_merge_recommendations_recommended_as_lane_community_id_idx"
  ON "community_merge_recommendations"("recommended_as_lane_community_id");

CREATE INDEX "community_proposal_events_proposal_id_created_at_idx"
  ON "community_proposal_events"("proposal_id", "created_at");

ALTER TABLE "community_proposals"
  ADD CONSTRAINT "community_proposals_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "human_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "community_proposals"
  ADD CONSTRAINT "community_proposals_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "human_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_proposals"
  ADD CONSTRAINT "community_proposals_source_community_id_fkey"
  FOREIGN KEY ("source_community_id") REFERENCES "communities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_proposals"
  ADD CONSTRAINT "community_proposals_resulting_community_id_fkey"
  FOREIGN KEY ("resulting_community_id") REFERENCES "communities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_proposals"
  ADD CONSTRAINT "community_proposals_merged_into_community_id_fkey"
  FOREIGN KEY ("merged_into_community_id") REFERENCES "communities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_merge_recommendations"
  ADD CONSTRAINT "community_merge_recommendations_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "community_proposals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_merge_recommendations"
  ADD CONSTRAINT "community_merge_recommendations_duplicate_of_community_id_fkey"
  FOREIGN KEY ("duplicate_of_community_id") REFERENCES "communities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_merge_recommendations"
  ADD CONSTRAINT "community_merge_recommendations_recommended_as_lane_community_id_fkey"
  FOREIGN KEY ("recommended_as_lane_community_id") REFERENCES "communities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_proposal_events"
  ADD CONSTRAINT "community_proposal_events_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "community_proposals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
