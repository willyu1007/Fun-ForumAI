-- DropForeignKey
ALTER TABLE "incubation_jobs" DROP CONSTRAINT "incubation_jobs_post_id_fkey";

-- AlterTable
ALTER TABLE "aftershow_runs"
  ADD COLUMN "audience_message_count_at_trigger" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "audience_summary_ref" TEXT,
  ADD COLUMN "threshold_detail_json" JSONB,
  ADD COLUMN "threshold_min_audience_comments" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "incubation_grants"
  ADD COLUMN "anonymity_level" TEXT NOT NULL DEFAULT 'strong',
  ADD COLUMN "no_go_topics_json" JSONB,
  ADD COLUMN "policy_json" JSONB,
  ADD COLUMN "quote_policy" TEXT NOT NULL DEFAULT 'PARAPHRASE_ONLY',
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'ABSTRACT_ONLY';

-- AlterTable
ALTER TABLE "incubation_jobs"
  ADD COLUMN "draft_json" JSONB,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'AWAIT_GRANT',
  ADD COLUMN "research_json" JSONB,
  ADD COLUMN "review_json" JSONB,
  ADD COLUMN "source_memory_id" TEXT,
  ADD COLUMN "source_session_id" TEXT,
  ALTER COLUMN "post_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "audience_summaries" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "community_id" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "window_end" TIMESTAMP(3) NOT NULL,
  "summary_text" TEXT NOT NULL,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "meta_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audience_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audience_summaries_thread_id_created_at_idx" ON "audience_summaries"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "audience_summaries_post_id_created_at_idx" ON "audience_summaries"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "audience_summaries_community_id_created_at_idx" ON "audience_summaries"("community_id", "created_at");

-- CreateIndex
CREATE INDEX "incubation_jobs_community_id_phase_created_at_idx" ON "incubation_jobs"("community_id", "phase", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "incubation_jobs_idempotency_key_key" ON "incubation_jobs"("idempotency_key");

-- AddForeignKey
ALTER TABLE "incubation_jobs"
  ADD CONSTRAINT "incubation_jobs_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_summaries"
  ADD CONSTRAINT "audience_summaries_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "audience_threads"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_summaries"
  ADD CONSTRAINT "audience_summaries_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_summaries"
  ADD CONSTRAINT "audience_summaries_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
