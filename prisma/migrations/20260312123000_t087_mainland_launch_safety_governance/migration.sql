DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdentityVerificationStatus') THEN
    CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdentityVerificationMethod') THEN
    CREATE TYPE "IdentityVerificationMethod" AS ENUM ('MANUAL_REVIEW', 'SUPPLIER_PLACEHOLDER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageDeliveryStatus') THEN
    CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING_REVIEW', 'DELIVERED', 'REWRITTEN', 'REFUSED', 'BLOCKED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewCaseType') THEN
    CREATE TYPE "ReviewCaseType" AS ENUM ('MODERATION', 'COMPLAINT', 'APPEAL', 'IDENTITY_REVIEW', 'CONFIG_REVIEW', 'HOT_TOPIC');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewCaseStatus') THEN
    CREATE TYPE "ReviewCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewTaskStatus') THEN
    CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ComplaintStatus') THEN
    CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'LINKED', 'RESOLVED', 'REJECTED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppealStatus') THEN
    CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'LINKED', 'RESOLVED', 'REJECTED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConfigReviewStatus') THEN
    CREATE TYPE "ConfigReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "agent_configs"
ADD COLUMN IF NOT EXISTS "risk_level" "ConfigRiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN IF NOT EXISTS "review_status" "ConfigReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN IF NOT EXISTS "review_case_id" TEXT,
ADD COLUMN IF NOT EXISTS "lint_warnings_json" JSONB;

ALTER TABLE "room_messages"
ADD COLUMN IF NOT EXISTS "moderation_metadata_json" JSONB;

ALTER TABLE "private_messages"
ADD COLUMN IF NOT EXISTS "delivery_status" "MessageDeliveryStatus" NOT NULL DEFAULT 'DELIVERED',
ADD COLUMN IF NOT EXISTS "moderation_metadata_json" JSONB;

ALTER TABLE "agent_privacy_settings"
ADD COLUMN IF NOT EXISTS "public_disclosure_cap" INTEGER;

CREATE TABLE IF NOT EXISTS "user_identity_verifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "method" "IdentityVerificationMethod" NOT NULL DEFAULT 'MANUAL_REVIEW',
  "reviewed_by_user_id" TEXT,
  "reason" TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "meta_json" JSONB,
  CONSTRAINT "user_identity_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "policy_snapshots" (
  "id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "community_id" TEXT,
  "agent_id" TEXT,
  "user_id" TEXT,
  "scene" TEXT,
  "normalized_text" TEXT NOT NULL,
  "moderation_json" JSONB NOT NULL,
  "decision_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "moderation_cases" (
  "id" TEXT NOT NULL,
  "case_type" "ReviewCaseType" NOT NULL,
  "status" "ReviewCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" INTEGER NOT NULL DEFAULT 50,
  "summary_text" TEXT,
  "opened_reason" TEXT,
  "opened_by" TEXT NOT NULL DEFAULT 'system',
  "assigned_to_user_id" TEXT,
  "linked_policy_snapshot_id" TEXT,
  "linked_complaint_ticket_id" TEXT,
  "linked_appeal_request_id" TEXT,
  "resolution_action" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "moderation_case_targets" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "community_id" TEXT,
  "agent_id" TEXT,
  "user_id" TEXT,
  "room_id" TEXT,
  "session_id" TEXT,
  "message_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "moderation_case_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "moderation_evidence_snapshots" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "snapshot_type" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "moderation_evidence_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "review_tasks" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "task_type" TEXT NOT NULL,
  "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignee_user_id" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "governance_action_logs" (
  "id" TEXT NOT NULL,
  "case_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason" TEXT,
  "result_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "governance_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "complaint_tickets" (
  "id" TEXT NOT NULL,
  "reporter_user_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "reason_code" TEXT NOT NULL,
  "detail_text" TEXT,
  "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
  "linked_case_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "complaint_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appeal_requests" (
  "id" TEXT NOT NULL,
  "requester_user_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "linked_case_id" TEXT,
  "linked_complaint_ticket_id" TEXT,
  "reason" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appeal_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "risk_event_logs" (
  "id" TEXT NOT NULL,
  "policy_snapshot_id" TEXT,
  "case_id" TEXT,
  "channel" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "risk_level" TEXT,
  "risk_score" DOUBLE PRECISION,
  "risk_categories" JSONB DEFAULT '[]'::jsonb,
  "target_type" TEXT,
  "target_id" TEXT,
  "community_id" TEXT,
  "agent_id" TEXT,
  "user_id" TEXT,
  "room_id" TEXT,
  "session_id" TEXT,
  "message_id" TEXT,
  "detail_text" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "risk_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_identity_verifications_user_id_submitted_at_idx"
ON "user_identity_verifications"("user_id", "submitted_at");

CREATE INDEX IF NOT EXISTS "user_identity_verifications_status_submitted_at_idx"
ON "user_identity_verifications"("status", "submitted_at");

CREATE INDEX IF NOT EXISTS "policy_snapshots_content_hash_channel_target_type_idx"
ON "policy_snapshots"("content_hash", "channel", "target_type");

CREATE INDEX IF NOT EXISTS "policy_snapshots_channel_created_at_idx"
ON "policy_snapshots"("channel", "created_at");

CREATE INDEX IF NOT EXISTS "policy_snapshots_target_type_target_id_idx"
ON "policy_snapshots"("target_type", "target_id");

CREATE INDEX IF NOT EXISTS "policy_snapshots_community_id_created_at_idx"
ON "policy_snapshots"("community_id", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_cases_status_priority_created_at_idx"
ON "moderation_cases"("status", "priority", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_cases_case_type_created_at_idx"
ON "moderation_cases"("case_type", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_case_targets_case_id_created_at_idx"
ON "moderation_case_targets"("case_id", "created_at");

CREATE INDEX IF NOT EXISTS "moderation_case_targets_target_type_target_id_idx"
ON "moderation_case_targets"("target_type", "target_id");

CREATE INDEX IF NOT EXISTS "moderation_evidence_snapshots_case_id_created_at_idx"
ON "moderation_evidence_snapshots"("case_id", "created_at");

CREATE INDEX IF NOT EXISTS "review_tasks_case_id_status_created_at_idx"
ON "review_tasks"("case_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "review_tasks_assignee_user_id_status_created_at_idx"
ON "review_tasks"("assignee_user_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "governance_action_logs_case_id_created_at_idx"
ON "governance_action_logs"("case_id", "created_at");

CREATE INDEX IF NOT EXISTS "governance_action_logs_target_type_target_id_created_at_idx"
ON "governance_action_logs"("target_type", "target_id", "created_at");

CREATE INDEX IF NOT EXISTS "complaint_tickets_status_created_at_idx"
ON "complaint_tickets"("status", "created_at");

CREATE INDEX IF NOT EXISTS "complaint_tickets_target_type_target_id_created_at_idx"
ON "complaint_tickets"("target_type", "target_id", "created_at");

CREATE INDEX IF NOT EXISTS "complaint_tickets_reporter_user_id_created_at_idx"
ON "complaint_tickets"("reporter_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "appeal_requests_status_created_at_idx"
ON "appeal_requests"("status", "created_at");

CREATE INDEX IF NOT EXISTS "appeal_requests_target_type_target_id_created_at_idx"
ON "appeal_requests"("target_type", "target_id", "created_at");

CREATE INDEX IF NOT EXISTS "appeal_requests_requester_user_id_created_at_idx"
ON "appeal_requests"("requester_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "risk_event_logs_channel_created_at_idx"
ON "risk_event_logs"("channel", "created_at");

CREATE INDEX IF NOT EXISTS "risk_event_logs_action_created_at_idx"
ON "risk_event_logs"("action", "created_at");

CREATE INDEX IF NOT EXISTS "risk_event_logs_target_type_target_id_created_at_idx"
ON "risk_event_logs"("target_type", "target_id", "created_at");

CREATE INDEX IF NOT EXISTS "risk_event_logs_agent_id_created_at_idx"
ON "risk_event_logs"("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "risk_event_logs_user_id_created_at_idx"
ON "risk_event_logs"("user_id", "created_at");
