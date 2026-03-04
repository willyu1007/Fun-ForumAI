-- CreateEnum
CREATE TYPE "AgentCommunityMembershipStatus" AS ENUM ('ACTIVE', 'MUTED', 'BANNED');

-- CreateEnum
CREATE TYPE "IncubationJobStatus" AS ENUM ('PENDING', 'GRANTED', 'REJECTED', 'QUARANTINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IncubationGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AudienceThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AftershowRunStatus" AS ENUM ('CREATED', 'SKIPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "HumanVoteTarget" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "HumanVoteDirection" AS ENUM ('UP', 'DOWN', 'NEUTRAL');

-- DropForeignKey
ALTER TABLE "agent_inclination_assets" DROP CONSTRAINT "agent_inclination_assets_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_inclination_assets" DROP CONSTRAINT "agent_inclination_assets_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_stat_events" DROP CONSTRAINT "agent_stat_events_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_states" DROP CONSTRAINT "agent_states_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_stats" DROP CONSTRAINT "agent_stats_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "human_agent_follows" DROP CONSTRAINT "human_agent_follows_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "human_agent_follows" DROP CONSTRAINT "human_agent_follows_user_id_fkey";

-- DropForeignKey
ALTER TABLE "human_votes" DROP CONSTRAINT "human_votes_voter_user_id_fkey";

-- DropForeignKey
ALTER TABLE "post_media" DROP CONSTRAINT "post_media_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "post_media" DROP CONSTRAINT "post_media_post_id_fkey";

-- DropForeignKey
ALTER TABLE "ppr_snapshots" DROP CONSTRAINT "ppr_snapshots_candidate_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "ppr_snapshots" DROP CONSTRAINT "ppr_snapshots_source_agent_id_fkey";

-- AlterTable
ALTER TABLE "agent_community_memberships" ADD COLUMN     "status" "AgentCommunityMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "status_set_at" TIMESTAMP(3),
ADD COLUMN     "status_set_by" TEXT;

-- AlterTable
ALTER TABLE "human_votes"
  DROP CONSTRAINT IF EXISTS "human_votes_target_type_chk",
  DROP CONSTRAINT IF EXISTS "human_votes_direction_chk";

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "human_votes"
    WHERE "target_type"::text NOT IN ('POST', 'COMMENT')
  ) THEN
    RAISE EXCEPTION 'human_votes.target_type contains values outside POST/COMMENT and cannot be migrated to HumanVoteTarget';
  END IF;
END $$;

ALTER TABLE "human_votes"
  ALTER COLUMN "target_type" TYPE "HumanVoteTarget" USING ("target_type"::text::"HumanVoteTarget"),
  ALTER COLUMN "direction" TYPE "HumanVoteDirection" USING ("direction"::text::"HumanVoteDirection");

-- CreateTable
CREATE TABLE "agent_stage_tier_snapshots" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "achievement_points" DOUBLE PRECISION NOT NULL,
    "chronicle_points" DOUBLE PRECISION NOT NULL,
    "trust_penalty" DOUBLE PRECISION NOT NULL,
    "reasoning_json" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_stage_tier_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_jobs" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "proposer_agent_id" TEXT NOT NULL,
    "status" "IncubationJobStatus" NOT NULL DEFAULT 'PENDING',
    "strict_t4" BOOLEAN NOT NULL DEFAULT true,
    "grant_required" BOOLEAN NOT NULL DEFAULT true,
    "premod_required" BOOLEAN NOT NULL DEFAULT true,
    "redaction_level" TEXT NOT NULL DEFAULT 'strong',
    "source_count" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_grants" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "reviewer_agent_id" TEXT,
    "reviewer_user_id" TEXT,
    "status" "IncubationGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "ttl_hours" INTEGER NOT NULL DEFAULT 168,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_source_bundles" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "source_url" TEXT,
    "title" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incubation_source_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubation_events" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incubation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_threads" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "status" "AudienceThreadStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftershow_runs" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "AftershowRunStatus" NOT NULL DEFAULT 'CREATED',
    "threshold_min_comments" INTEGER NOT NULL DEFAULT 30,
    "threshold_min_human_votes" INTEGER NOT NULL DEFAULT 10,
    "comments_at_trigger" INTEGER NOT NULL DEFAULT 0,
    "human_vote_score_at_trigger" INTEGER NOT NULL DEFAULT 0,
    "triggered_by_agent_id" TEXT,
    "triggered_by_user_id" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aftershow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_stage_tier_snapshots_agent_id_key" ON "agent_stage_tier_snapshots"("agent_id");

-- CreateIndex
CREATE INDEX "agent_stage_tier_snapshots_tier_score_idx" ON "agent_stage_tier_snapshots"("tier", "score");

-- CreateIndex
CREATE INDEX "incubation_jobs_community_id_status_created_at_idx" ON "incubation_jobs"("community_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "incubation_jobs_proposer_agent_id_status_created_at_idx" ON "incubation_jobs"("proposer_agent_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "incubation_grants_job_id_status_granted_at_idx" ON "incubation_grants"("job_id", "status", "granted_at");

-- CreateIndex
CREATE INDEX "incubation_grants_expires_at_idx" ON "incubation_grants"("expires_at");

-- CreateIndex
CREATE INDEX "incubation_source_bundles_job_id_created_at_idx" ON "incubation_source_bundles"("job_id", "created_at");

-- CreateIndex
CREATE INDEX "incubation_events_job_id_created_at_idx" ON "incubation_events"("job_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "audience_threads_post_id_key" ON "audience_threads"("post_id");

-- CreateIndex
CREATE INDEX "audience_threads_community_id_status_created_at_idx" ON "audience_threads"("community_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "audience_messages_thread_id_created_at_idx" ON "audience_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "audience_messages_author_user_id_created_at_idx" ON "audience_messages"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "aftershow_runs_post_id_created_at_idx" ON "aftershow_runs"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "aftershow_runs_community_id_mode_created_at_idx" ON "aftershow_runs"("community_id", "mode", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "human_votes_target_type_target_id_idx" ON "human_votes"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "human_votes_voter_user_id_target_type_target_id_key" ON "human_votes"("voter_user_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "human_votes" ADD CONSTRAINT "human_votes_voter_user_id_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_agent_follows" ADD CONSTRAINT "human_agent_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "human_agent_follows" ADD CONSTRAINT "human_agent_follows_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_inclination_assets" ADD CONSTRAINT "agent_inclination_assets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_inclination_assets" ADD CONSTRAINT "agent_inclination_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "agent_inclination_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppr_snapshots" ADD CONSTRAINT "ppr_snapshots_source_agent_id_fkey" FOREIGN KEY ("source_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppr_snapshots" ADD CONSTRAINT "ppr_snapshots_candidate_agent_id_fkey" FOREIGN KEY ("candidate_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stage_tier_snapshots" ADD CONSTRAINT "agent_stage_tier_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_jobs" ADD CONSTRAINT "incubation_jobs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_jobs" ADD CONSTRAINT "incubation_jobs_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_jobs" ADD CONSTRAINT "incubation_jobs_proposer_agent_id_fkey" FOREIGN KEY ("proposer_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_grants" ADD CONSTRAINT "incubation_grants_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "incubation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_grants" ADD CONSTRAINT "incubation_grants_reviewer_agent_id_fkey" FOREIGN KEY ("reviewer_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_grants" ADD CONSTRAINT "incubation_grants_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_source_bundles" ADD CONSTRAINT "incubation_source_bundles_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "incubation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_events" ADD CONSTRAINT "incubation_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "incubation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubation_events" ADD CONSTRAINT "incubation_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_threads" ADD CONSTRAINT "audience_threads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_threads" ADD CONSTRAINT "audience_threads_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_messages" ADD CONSTRAINT "audience_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "audience_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_messages" ADD CONSTRAINT "audience_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_runs" ADD CONSTRAINT "aftershow_runs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_runs" ADD CONSTRAINT "aftershow_runs_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_runs" ADD CONSTRAINT "aftershow_runs_triggered_by_agent_id_fkey" FOREIGN KEY ("triggered_by_agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stats" ADD CONSTRAINT "agent_stats_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_states" ADD CONSTRAINT "agent_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_stat_events" ADD CONSTRAINT "agent_stat_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "agent_achievements_agent_id_code_tier_scope_scope_key" RENAME TO "agent_achievements_agent_id_code_tier_scope_scope_key_key";

-- RenameIndex
ALTER INDEX "ppr_snapshots_source_agent_id_candidate_agent_id_community_id_t" RENAME TO "ppr_snapshots_source_agent_id_candidate_agent_id_community__key";
