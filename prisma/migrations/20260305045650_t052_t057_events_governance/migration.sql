-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "AftershowArtifactStatus" AS ENUM ('DUE', 'SNAPSHOT_CREATED', 'COMPOSED', 'PUBLISHED', 'ABORTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ConfigRiskLevel" AS ENUM ('LOW', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ConfigPatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'APPROVED', 'APPLIED', 'REJECTED', 'ROLLED_BACK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ConfigApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RoleAssignmentScope" AS ENUM ('COMMUNITY', 'POST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RoleAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "EventPlane" AS ENUM ('DATA', 'CONTROL', 'RUNTIME');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "EventActorType" AS ENUM ('AGENT', 'HUMAN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AFTERSHOW_CALLOUT';

-- DropIndex
DROP INDEX IF EXISTS "agent_community_memberships_active_unique_idx";

-- DropIndex
DROP INDEX IF EXISTS "agent_memories_public_observation_event_idempotency_idx";

-- DropIndex
DROP INDEX IF EXISTS "community_culture_digests_active_unique_idx";

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "actor_id" TEXT,
ADD COLUMN     "actor_type" "EventActorType" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "cause_event_id" TEXT,
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "plane" "EventPlane" NOT NULL DEFAULT 'DATA',
ADD COLUMN     "post_id" TEXT,
ADD COLUMN     "room_id" TEXT,
ADD COLUMN     "schema_version" TEXT NOT NULL DEFAULT 'v1';

-- CreateTable
CREATE TABLE "aftershow_artifacts" (
    "id" TEXT NOT NULL,
    "run_id" TEXT,
    "post_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "status" "AftershowArtifactStatus" NOT NULL DEFAULT 'DUE',
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "summary_text" TEXT NOT NULL,
    "content_json" JSONB,
    "audience_summary_ref" TEXT,
    "correlation_id" TEXT,
    "cause_event_id" TEXT,
    "idempotency_key" TEXT,
    "published_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aftershow_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftershow_callouts" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "audience_message_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_ref" TEXT,
    "notification_id" TEXT,
    "invalidated_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aftershow_callouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_config_versions" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules_json" JSONB NOT NULL,
    "source_patch_id" TEXT,
    "risk_level" "ConfigRiskLevel" NOT NULL DEFAULT 'LOW',
    "created_by_user_id" TEXT,
    "rollback_from_version_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_config_patches" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "base_version_id" TEXT,
    "status" "ConfigPatchStatus" NOT NULL DEFAULT 'DRAFT',
    "risk_level" "ConfigRiskLevel" NOT NULL DEFAULT 'LOW',
    "patch_json" JSONB NOT NULL,
    "proposed_rules_json" JSONB,
    "summary" TEXT,
    "reason" TEXT,
    "proposed_by_user_id" TEXT NOT NULL,
    "validated_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "applied_version_id" TEXT,
    "rejected_reason" TEXT,
    "validated_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "rolled_back_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_config_patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_config_approvals" (
    "id" TEXT NOT NULL,
    "patch_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "decision" "ConfigApprovalDecision" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_config_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "post_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "scope" "RoleAssignmentScope" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aftershow_artifacts_idempotency_key_key" ON "aftershow_artifacts"("idempotency_key");

-- CreateIndex
CREATE INDEX "aftershow_artifacts_post_id_created_at_idx" ON "aftershow_artifacts"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "aftershow_artifacts_community_id_status_created_at_idx" ON "aftershow_artifacts"("community_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "aftershow_artifacts_correlation_id_idx" ON "aftershow_artifacts"("correlation_id");

-- CreateIndex
CREATE INDEX "aftershow_callouts_user_id_created_at_idx" ON "aftershow_callouts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "aftershow_callouts_audience_message_id_idx" ON "aftershow_callouts"("audience_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "aftershow_callouts_artifact_id_user_id_audience_message_id_key" ON "aftershow_callouts"("artifact_id", "user_id", "audience_message_id");

-- CreateIndex
CREATE INDEX "community_config_versions_community_id_applied_at_idx" ON "community_config_versions"("community_id", "applied_at");

-- CreateIndex
CREATE INDEX "community_config_versions_source_patch_id_idx" ON "community_config_versions"("source_patch_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_config_versions_community_id_version_key" ON "community_config_versions"("community_id", "version");

-- CreateIndex
CREATE INDEX "community_config_patches_community_id_status_created_at_idx" ON "community_config_patches"("community_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "community_config_patches_proposed_by_user_id_created_at_idx" ON "community_config_patches"("proposed_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "community_config_patches_applied_version_id_idx" ON "community_config_patches"("applied_version_id");

-- CreateIndex
CREATE INDEX "community_config_approvals_patch_id_created_at_idx" ON "community_config_approvals"("patch_id", "created_at");

-- CreateIndex
CREATE INDEX "community_config_approvals_actor_user_id_created_at_idx" ON "community_config_approvals"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "role_assignments_community_id_scope_scope_id_status_idx" ON "role_assignments"("community_id", "scope", "scope_id", "status");

-- CreateIndex
CREATE INDEX "role_assignments_post_id_status_idx" ON "role_assignments"("post_id", "status");

-- CreateIndex
CREATE INDEX "role_assignments_agent_id_status_expires_at_idx" ON "role_assignments"("agent_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "events_plane_event_type_created_at_idx" ON "events"("plane", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "events_community_id_created_at_idx" ON "events"("community_id", "created_at");

-- CreateIndex
CREATE INDEX "events_correlation_id_idx" ON "events"("correlation_id");

-- CreateIndex
CREATE INDEX "room_memberships_agent_id_idx" ON "room_memberships"("agent_id");

-- AddForeignKey
ALTER TABLE "aftershow_artifacts" ADD CONSTRAINT "aftershow_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "aftershow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_artifacts" ADD CONSTRAINT "aftershow_artifacts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_artifacts" ADD CONSTRAINT "aftershow_artifacts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_callouts" ADD CONSTRAINT "aftershow_callouts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "aftershow_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_callouts" ADD CONSTRAINT "aftershow_callouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftershow_callouts" ADD CONSTRAINT "aftershow_callouts_audience_message_id_fkey" FOREIGN KEY ("audience_message_id") REFERENCES "audience_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_versions" ADD CONSTRAINT "community_config_versions_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_versions" ADD CONSTRAINT "community_config_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_patches" ADD CONSTRAINT "community_config_patches_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_patches" ADD CONSTRAINT "community_config_patches_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_patches" ADD CONSTRAINT "community_config_patches_validated_by_user_id_fkey" FOREIGN KEY ("validated_by_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_patches" ADD CONSTRAINT "community_config_patches_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "human_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_approvals" ADD CONSTRAINT "community_config_approvals_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "community_config_patches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_config_approvals" ADD CONSTRAINT "community_config_approvals_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "human_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
