-- CreateEnum
CREATE TYPE "PrivateSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionInitiator" AS ENUM ('HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PrivateAuthorType" AS ENUM ('HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('PRIVATE_CHAT', 'PUBLIC_OBSERVATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('AGENT_PROACTIVE', 'AGENT_FIRST_POST', 'GROWTH_MILESTONE', 'GOVERNANCE');

-- AlterTable
ALTER TABLE "rooms" ALTER COLUMN "slug" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "private_sessions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "human_user_id" TEXT NOT NULL,
    "status" "PrivateSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "initiator" "SessionInitiator" NOT NULL DEFAULT 'HUMAN',
    "trigger_type" TEXT,
    "trigger_ref" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "digest_status" "DigestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "private_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "author_type" "PrivateAuthorType" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "source_type" "MemorySource" NOT NULL,
    "source_session_id" TEXT,
    "summary_text" TEXT NOT NULL,
    "topic_tags" JSONB NOT NULL DEFAULT '[]',
    "key_facts" JSONB NOT NULL DEFAULT '[]',
    "sentiment" TEXT,
    "importance_score" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "privacy_floor" INTEGER NOT NULL DEFAULT 1,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "forgotten" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3),

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_privacy_settings" (
    "agent_id" TEXT NOT NULL,
    "disclosure_level" INTEGER NOT NULL DEFAULT 1,
    "public_memory_budget" INTEGER NOT NULL DEFAULT 1000,
    "public_memory_top_k" INTEGER NOT NULL DEFAULT 4,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "agent_privacy_settings_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "private_sessions_agent_id_started_at_idx" ON "private_sessions"("agent_id", "started_at");

-- CreateIndex
CREATE INDEX "private_sessions_human_user_id_idx" ON "private_sessions"("human_user_id");

-- CreateIndex
CREATE INDEX "private_messages_session_id_created_at_idx" ON "private_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_memories_agent_id_forgotten_importance_score_idx" ON "agent_memories"("agent_id", "forgotten", "importance_score");

-- CreateIndex
CREATE INDEX "agent_memories_agent_id_source_type_idx" ON "agent_memories"("agent_id", "source_type");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");

-- AddForeignKey
ALTER TABLE "private_sessions" ADD CONSTRAINT "private_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_sessions" ADD CONSTRAINT "private_sessions_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_messages" ADD CONSTRAINT "private_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "private_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "private_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_privacy_settings" ADD CONSTRAINT "agent_privacy_settings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_privacy_settings" ADD CONSTRAINT "agent_privacy_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
