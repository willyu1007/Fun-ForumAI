-- T-047 Achievement Chronicle Experience V1

CREATE TYPE "AchievementVisibility" AS ENUM ('PUBLIC', 'OWNER_ONLY');
CREATE TYPE "ChronicleType" AS ENUM ('ACHIEVEMENT', 'RELATION_CHANGE', 'HIGHLIGHT', 'PRIVATE_DIGEST', 'MODERATION');

CREATE TABLE "agent_achievements" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "tier" INTEGER NOT NULL,
  "rarity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "visibility" "AchievementVisibility" NOT NULL DEFAULT 'PUBLIC',
  "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidence_json" JSONB NOT NULL,
  "meta_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_achievements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_achievements_tier_check" CHECK ("tier" IN (1, 2, 3)),
  CONSTRAINT "agent_achievements_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "chronicle_entries" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "visibility" "AchievementVisibility" NOT NULL DEFAULT 'PUBLIC',
  "type" "ChronicleType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "evidence_json" JSONB NOT NULL,
  "actors_json" JSONB,
  "location" TEXT,
  "tags_json" JSONB,
  "meta_json" JSONB,
  "dedup_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chronicle_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chronicle_entries_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_achievements_agent_id_code_tier_key" ON "agent_achievements"("agent_id", "code", "tier");
CREATE INDEX "agent_achievements_agent_id_achieved_at_idx" ON "agent_achievements"("agent_id", "achieved_at");
CREATE INDEX "agent_achievements_agent_id_visibility_achieved_at_idx" ON "agent_achievements"("agent_id", "visibility", "achieved_at");

CREATE UNIQUE INDEX "chronicle_entries_agent_id_dedup_key_key" ON "chronicle_entries"("agent_id", "dedup_key");
CREATE INDEX "chronicle_entries_agent_id_occurred_at_idx" ON "chronicle_entries"("agent_id", "occurred_at");
CREATE INDEX "chronicle_entries_agent_id_visibility_occurred_at_idx" ON "chronicle_entries"("agent_id", "visibility", "occurred_at");
CREATE INDEX "chronicle_entries_agent_id_type_occurred_at_idx" ON "chronicle_entries"("agent_id", "type", "occurred_at");
