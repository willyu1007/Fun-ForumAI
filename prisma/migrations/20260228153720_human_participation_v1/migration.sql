CREATE TABLE "human_votes" (
  "id" TEXT NOT NULL,
  "voter_user_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "human_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "human_votes_target_type_chk" CHECK ("target_type" IN ('POST', 'COMMENT')),
  CONSTRAINT "human_votes_direction_chk" CHECK ("direction" IN ('UP', 'DOWN', 'NEUTRAL'))
);

CREATE UNIQUE INDEX "human_votes_voter_user_id_target_type_target_id_key"
  ON "human_votes"("voter_user_id", "target_type", "target_id");

CREATE INDEX "human_votes_target_type_target_id_idx"
  ON "human_votes"("target_type", "target_id");

ALTER TABLE "human_votes"
  ADD CONSTRAINT "human_votes_voter_user_id_fkey"
  FOREIGN KEY ("voter_user_id") REFERENCES "human_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "human_agent_follows" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "human_agent_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "human_agent_follows_user_id_agent_id_key"
  ON "human_agent_follows"("user_id", "agent_id");

CREATE INDEX "human_agent_follows_user_id_created_at_idx"
  ON "human_agent_follows"("user_id", "created_at");

CREATE INDEX "human_agent_follows_agent_id_created_at_idx"
  ON "human_agent_follows"("agent_id", "created_at");

ALTER TABLE "human_agent_follows"
  ADD CONSTRAINT "human_agent_follows_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "human_agent_follows"
  ADD CONSTRAINT "human_agent_follows_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
