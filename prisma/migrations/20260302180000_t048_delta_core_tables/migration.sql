-- T-048 Delta core tables: memberships, signal logs, community culture digests

DO $$ BEGIN
  CREATE TYPE "AgentCommunityMembershipRole" AS ENUM ('RESIDENT', 'GUEST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentCommunityMembershipSource" AS ENUM ('MANUAL', 'DERIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityCultureDigestStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "agent_community_memberships" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "role" "AgentCommunityMembershipRole" NOT NULL DEFAULT 'RESIDENT',
  "source" "AgentCommunityMembershipSource" NOT NULL DEFAULT 'MANUAL',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_community_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_signal_logs" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "signal_kind" TEXT NOT NULL,
  "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "visibility" "AchievementVisibility" NOT NULL DEFAULT 'OWNER_ONLY',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidence_json" JSONB NOT NULL,
  "meta_json" JSONB,
  "dedup_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_signal_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "community_culture_digests" (
  "id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "digest_json" JSONB NOT NULL,
  "source_window_days" INTEGER NOT NULL DEFAULT 7,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CommunityCultureDigestStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_culture_digests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_community_memberships_agent_id_left_at_idx"
  ON "agent_community_memberships"("agent_id", "left_at");
CREATE INDEX IF NOT EXISTS "agent_community_memberships_community_id_left_at_idx"
  ON "agent_community_memberships"("community_id", "left_at");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_community_memberships_active_unique_idx"
  ON "agent_community_memberships"("agent_id", "community_id")
  WHERE "left_at" IS NULL;

CREATE INDEX IF NOT EXISTS "agent_signal_logs_agent_id_signal_kind_occurred_at_idx"
  ON "agent_signal_logs"("agent_id", "signal_kind", "occurred_at");
CREATE INDEX IF NOT EXISTS "agent_signal_logs_agent_id_visibility_occurred_at_idx"
  ON "agent_signal_logs"("agent_id", "visibility", "occurred_at");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_signal_logs_agent_id_dedup_key_key"
  ON "agent_signal_logs"("agent_id", "dedup_key");

CREATE INDEX IF NOT EXISTS "community_culture_digests_community_id_status_expires_at_idx"
  ON "community_culture_digests"("community_id", "status", "expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "community_culture_digests_community_id_version_key"
  ON "community_culture_digests"("community_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "community_culture_digests_active_unique_idx"
  ON "community_culture_digests"("community_id")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "agent_community_memberships"
  ADD CONSTRAINT "agent_community_memberships_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_community_memberships"
  ADD CONSTRAINT "agent_community_memberships_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agent_signal_logs"
  ADD CONSTRAINT "agent_signal_logs_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "community_culture_digests"
  ADD CONSTRAINT "community_culture_digests_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
