-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'LIMITED', 'QUARANTINED', 'BANNED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'GRAY', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VoteTarget" AS ENUM ('POST', 'COMMENT', 'MESSAGE');

-- CreateEnum
CREATE TYPE "VoteDirection" AS ENUM ('UP', 'DOWN', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "ModerationResult" AS ENUM ('APPROVE', 'FOLD', 'QUARANTINE', 'REJECT');

-- CreateTable
CREATE TABLE "human_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "persona_version" INTEGER NOT NULL DEFAULT 1,
    "reputation_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "rules_json" JSONB,
    "visibility_default" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "author_agent_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags_json" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "state" "ContentState" NOT NULL DEFAULT 'PENDING',
    "moderation_metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "author_agent_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "state" "ContentState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "voter_agent_id" TEXT NOT NULL,
    "target_type" "VoteTarget" NOT NULL,
    "target_id" TEXT NOT NULL,
    "direction" "VoteDirection" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "trigger_event_id" TEXT NOT NULL,
    "input_digest" TEXT NOT NULL,
    "output_json" JSONB,
    "moderation_result" "ModerationResult",
    "token_cost" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_type" TEXT NOT NULL DEFAULT 'open_mic',
    "rules_json" JSONB,
    "visibility_default" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_memberships" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "room_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_messages" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "author_agent_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "state" "ContentState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "reactor_agent_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "human_users_email_key" ON "human_users"("email");

-- CreateIndex
CREATE INDEX "agents_owner_id_idx" ON "agents"("owner_id");

-- CreateIndex
CREATE INDEX "agent_configs_agent_id_effective_at_idx" ON "agent_configs"("agent_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE INDEX "posts_community_id_created_at_idx" ON "posts"("community_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_agent_id_idx" ON "posts"("author_agent_id");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_parent_comment_id_idx" ON "comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "comments_author_agent_id_idx" ON "comments"("author_agent_id");

-- CreateIndex
CREATE INDEX "votes_target_type_target_id_idx" ON "votes"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_voter_agent_id_target_type_target_id_key" ON "votes"("voter_agent_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_idempotency_key_key" ON "events"("idempotency_key");

-- CreateIndex
CREATE INDEX "events_event_type_created_at_idx" ON "events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_agent_id_created_at_idx" ON "agent_runs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_trigger_event_id_idx" ON "agent_runs"("trigger_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_memberships_room_id_agent_id_key" ON "room_memberships"("room_id", "agent_id");

-- CreateIndex
CREATE INDEX "room_messages_room_id_created_at_idx" ON "room_messages"("room_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_reactor_agent_id_message_id_reaction_type_key" ON "message_reactions"("reactor_agent_id", "message_id", "reaction_type");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_agent_id_fkey" FOREIGN KEY ("voter_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_trigger_event_id_fkey" FOREIGN KEY ("trigger_event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_author_agent_id_fkey" FOREIGN KEY ("author_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_reactor_agent_id_fkey" FOREIGN KEY ("reactor_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "room_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
