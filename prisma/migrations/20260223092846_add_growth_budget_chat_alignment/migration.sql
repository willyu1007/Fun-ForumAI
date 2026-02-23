-- AlterTable: rooms — add new columns, drop old columns
ALTER TABLE "rooms" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "rooms" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "rooms" ADD COLUMN "community_id" TEXT;
ALTER TABLE "rooms" ADD COLUMN "created_by_agent_id" TEXT;
ALTER TABLE "rooms" ADD COLUMN "max_agents" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "rooms" ADD COLUMN "tick_interval_base" INTEGER NOT NULL DEFAULT 20000;
ALTER TABLE "rooms" ADD COLUMN "last_message_at" TIMESTAMP(3);
ALTER TABLE "rooms" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill slug from id for any existing rows, then add unique constraint
UPDATE "rooms" SET "slug" = "id" WHERE "slug" = '';

-- Drop old columns that are no longer in the schema
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "room_type";
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "rules_json";
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "visibility_default";

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- AlterTable: room_memberships — add new columns
ALTER TABLE "room_memberships" ADD COLUMN "join_source" TEXT NOT NULL DEFAULT 'dispatched';
ALTER TABLE "room_memberships" ADD COLUMN "personal_tick_interval" INTEGER NOT NULL DEFAULT 25000;
ALTER TABLE "room_memberships" ADD COLUMN "messages_this_hour" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "room_memberships" ADD COLUMN "last_spoke_at" TIMESTAMP(3);

-- AlterTable: room_messages — add new columns
ALTER TABLE "room_messages" ADD COLUMN "message_kind" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "room_messages" ADD COLUMN "parent_message_id" TEXT;
ALTER TABLE "room_messages" ADD COLUMN "vote_score" INTEGER NOT NULL DEFAULT 0;

-- Backfill created_by_agent_id for existing rooms (use first membership agent or placeholder)
UPDATE "rooms" r SET "created_by_agent_id" = (
  SELECT rm."agent_id" FROM "room_memberships" rm WHERE rm."room_id" = r."id" LIMIT 1
) WHERE r."created_by_agent_id" IS NULL;

-- If still null (rooms with no members), set to a placeholder that will be cleaned up
UPDATE "rooms" SET "created_by_agent_id" = (SELECT "id" FROM "agents" LIMIT 1) WHERE "created_by_agent_id" IS NULL;

-- Now make it NOT NULL (only if there are agents; otherwise the migration will succeed on empty DB)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "rooms" WHERE "created_by_agent_id" IS NULL) THEN
    RAISE NOTICE 'Some rooms still have null created_by_agent_id — skipping NOT NULL constraint';
  ELSE
    ALTER TABLE "rooms" ALTER COLUMN "created_by_agent_id" SET NOT NULL;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_agent_id_fkey" FOREIGN KEY ("created_by_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: agent_growth
CREATE TABLE "agent_growth" (
    "agent_id" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "trait_slots" INTEGER NOT NULL DEFAULT 0,
    "instruction_slots" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_growth_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable: agent_traits
CREATE TABLE "agent_traits" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "trait_code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipped_at" TIMESTAMP(3),
    "evidence" TEXT,

    CONSTRAINT "agent_traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable: growth_events
CREATE TABLE "growth_events" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xp_delta" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_instructions
CREATE TABLE "agent_instructions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "trigger_type" TEXT NOT NULL,
    "trigger_params" JSONB,
    "body" TEXT NOT NULL,
    "times_triggered" INTEGER NOT NULL DEFAULT 0,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_budgets
CREATE TABLE "agent_budgets" (
    "agent_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'balanced',
    "daily_action_limit" INTEGER NOT NULL DEFAULT 60,
    "monthly_action_limit" INTEGER NOT NULL DEFAULT 1500,
    "daily_actions_used" INTEGER NOT NULL DEFAULT 0,
    "monthly_actions_used" INTEGER NOT NULL DEFAULT 0,
    "daily_reset_at" TIMESTAMP(3) NOT NULL,
    "monthly_reset_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_budgets_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable: cost_logs
CREATE TABLE "cost_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: agent_credits
CREATE TABLE "agent_credits" (
    "agent_id" TEXT NOT NULL,
    "credit_score" INTEGER NOT NULL DEFAULT 80,
    "risk_level" TEXT NOT NULL DEFAULT 'green',
    "violations" INTEGER NOT NULL DEFAULT 0,
    "last_violation_at" TIMESTAMP(3),

    CONSTRAINT "agent_credits_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable: credit_events
CREATE TABLE "credit_events" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_traits_agent_id_trait_code_key" ON "agent_traits"("agent_id", "trait_code");

-- CreateIndex
CREATE INDEX "growth_events_agent_id_created_at_idx" ON "growth_events"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_instructions_agent_id_idx" ON "agent_instructions"("agent_id");

-- CreateIndex
CREATE INDEX "cost_logs_agent_id_created_at_idx" ON "cost_logs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_events_agent_id_created_at_idx" ON "credit_events"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_growth" ADD CONSTRAINT "agent_growth_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_traits" ADD CONSTRAINT "agent_traits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_events" ADD CONSTRAINT "growth_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_instructions" ADD CONSTRAINT "agent_instructions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_budgets" ADD CONSTRAINT "agent_budgets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_logs" ADD CONSTRAINT "cost_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_credits" ADD CONSTRAINT "agent_credits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_events" ADD CONSTRAINT "credit_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
