DO $$
BEGIN
  CREATE TYPE "ComplaintType" AS ENUM (
    'CONTENT_REPORT',
    'PRIVACY_REQUEST',
    'DELETION_REQUEST',
    'IMPERSONATION_REPORT',
    'MISLABEL_REPORT',
    'HARASSMENT_REPORT',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AppealType" AS ENUM (
    'CONTENT_APPEAL',
    'ACCOUNT_LIMIT_APPEAL',
    'AGENT_RESTRICTION_APPEAL',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AppealRequesterType" AS ENUM (
    'USER',
    'OWNER',
    'OPERATOR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReviewQueue" AS ENUM (
    'MODERATION',
    'COMPLAINT',
    'APPEAL',
    'IDENTITY_REVIEW',
    'CONFIG_REVIEW',
    'PRIVACY',
    'DELETION',
    'HOT_TOPIC'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ModerationTargetRelationType" AS ENUM (
    'PRIMARY',
    'RELATED',
    'PARENT_THREAD',
    'SESSION_MEMBER',
    'OWNER',
    'AGENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "complaint_tickets"
  ADD COLUMN IF NOT EXISTS "complaint_type" "ComplaintType" NOT NULL DEFAULT 'CONTENT_REPORT',
  ADD COLUMN IF NOT EXISTS "attachments_json" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "resolution_json" JSONB;

ALTER TABLE "appeal_requests"
  ADD COLUMN IF NOT EXISTS "requester_type" "AppealRequesterType" NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "appeal_type" "AppealType" NOT NULL DEFAULT 'CONTENT_APPEAL',
  ADD COLUMN IF NOT EXISTS "result_json" JSONB;

ALTER TABLE "moderation_cases"
  ADD COLUMN IF NOT EXISTS "queue" "ReviewQueue" NOT NULL DEFAULT 'MODERATION',
  ADD COLUMN IF NOT EXISTS "risk_summary_json" JSONB,
  ADD COLUMN IF NOT EXISTS "primary_target_type" TEXT,
  ADD COLUMN IF NOT EXISTS "primary_target_id" TEXT,
  ADD COLUMN IF NOT EXISTS "sla_due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "claimed_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolved_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_note" TEXT;

ALTER TABLE "moderation_case_targets"
  ADD COLUMN IF NOT EXISTS "relation_type" "ModerationTargetRelationType" NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS "meta_json" JSONB;

ALTER TABLE "review_tasks"
  ADD COLUMN IF NOT EXISTS "queue" "ReviewQueue" NOT NULL DEFAULT 'MODERATION',
  ADD COLUMN IF NOT EXISTS "claim_token" TEXT,
  ADD COLUMN IF NOT EXISTS "claimed_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assigned_role" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_code" TEXT,
  ADD COLUMN IF NOT EXISTS "operator_note" TEXT;

ALTER TABLE "moderation_evidence_snapshots"
  ADD COLUMN IF NOT EXISTS "content_json" JSONB,
  ADD COLUMN IF NOT EXISTS "context_json" JSONB,
  ADD COLUMN IF NOT EXISTS "policy_hits_json" JSONB,
  ADD COLUMN IF NOT EXISTS "prompt_memory_json" JSONB,
  ADD COLUMN IF NOT EXISTS "topic_signals_json" JSONB,
  ADD COLUMN IF NOT EXISTS "action_history_json" JSONB,
  ADD COLUMN IF NOT EXISTS "evidence_package_json" JSONB;

CREATE INDEX IF NOT EXISTS "moderation_cases_queue_status_priority_created_at_idx"
ON "moderation_cases"("queue", "status", "priority", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_cases_primary_target_type_primary_target_id_created_at_idx"
ON "moderation_cases"("primary_target_type", "primary_target_id", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_case_targets_case_id_relation_type_created_at_idx"
ON "moderation_case_targets"("case_id", "relation_type", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_case_targets_target_type_target_id_relation_type_idx"
ON "moderation_case_targets"("target_type", "target_id", "relation_type");

CREATE INDEX IF NOT EXISTS "review_tasks_queue_status_created_at_idx"
ON "review_tasks"("queue", "status", "created_at");

CREATE INDEX IF NOT EXISTS "review_tasks_claimed_by_user_id_status_created_at_idx"
ON "review_tasks"("claimed_by_user_id", "status", "created_at");
