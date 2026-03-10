-- CreateEnum
CREATE TYPE "GuidanceActorType" AS ENUM ('VISITOR', 'USER');

-- CreateEnum
CREATE TYPE "GuidanceTrack" AS ENUM ('UNDECIDED', 'SPECTATOR', 'OWNER');

-- CreateEnum
CREATE TYPE "GuidanceStage" AS ENUM ('NEW_VISITOR', 'EXPLORING', 'FIRST_SUCCESS', 'RETAINED');

-- CreateEnum
CREATE TYPE "GuidanceInboxModule" AS ENUM ('CARD', 'RECEIPT');

-- CreateEnum
CREATE TYPE "GuidanceInboxStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "guidance_actor_states" (
    "id" TEXT NOT NULL,
    "actor_type" "GuidanceActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "current_track" "GuidanceTrack" NOT NULL DEFAULT 'UNDECIDED',
    "stage" "GuidanceStage" NOT NULL DEFAULT 'NEW_VISITOR',
    "explained_two_tracks" BOOLEAN NOT NULL DEFAULT false,
    "followed_first_agent_at" TIMESTAMP(3),
    "following_feed_seen_at" TIMESTAMP(3),
    "agent_created_at" TIMESTAMP(3),
    "private_session_created_at" TIMESTAMP(3),
    "private_session_ended_at" TIMESTAMP(3),
    "nurture_receipt_ready_at" TIMESTAMP(3),
    "watch_public_effect_at" TIMESTAMP(3),
    "latest_owner_agent_id" TEXT,
    "latest_receipt_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidance_actor_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_inbox" (
    "id" TEXT NOT NULL,
    "actor_type" "GuidanceActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "module_type" "GuidanceInboxModule" NOT NULL,
    "reason_code" TEXT NOT NULL,
    "status" "GuidanceInboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "dedup_key" TEXT,
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta_label" TEXT,
    "cta_target" TEXT,
    "payload_json" JSONB,
    "related_agent_id" TEXT,
    "related_session_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidance_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_event_log" (
    "id" TEXT NOT NULL,
    "actor_type" "GuidanceActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "dedup_key" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guidance_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guidance_actor_states_actor_type_actor_id_key" ON "guidance_actor_states"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "guidance_actor_states_actor_type_stage_updated_at_idx" ON "guidance_actor_states"("actor_type", "stage", "updated_at");

-- CreateIndex
CREATE INDEX "guidance_inbox_actor_type_actor_id_status_updated_at_idx" ON "guidance_inbox"("actor_type", "actor_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "guidance_inbox_actor_type_actor_id_unread_updated_at_idx" ON "guidance_inbox"("actor_type", "actor_id", "unread", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "guidance_inbox_actor_type_actor_id_dedup_key_key" ON "guidance_inbox"("actor_type", "actor_id", "dedup_key");

-- CreateIndex
CREATE INDEX "guidance_event_log_actor_type_actor_id_created_at_idx" ON "guidance_event_log"("actor_type", "actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guidance_event_log_actor_type_actor_id_dedup_key_key" ON "guidance_event_log"("actor_type", "actor_id", "dedup_key");
