-- CreateTable
CREATE TABLE "agent_inference_shadow_reviews" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "review_case_id" TEXT,
  "incumbent_family" TEXT NOT NULL,
  "incumbent_voice_line_id" TEXT NOT NULL,
  "challenger_family" TEXT NOT NULL,
  "challenger_voice_line_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary_json" JSONB NOT NULL,
  "evidence_json" JSONB NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collected_at" TIMESTAMP(3),
  "decided_at" TIMESTAMP(3),
  "decided_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_inference_shadow_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_inference_shadow_reviews_agent_id_created_at_idx"
  ON "agent_inference_shadow_reviews"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_inference_shadow_reviews_agent_id_status_updated_at_idx"
  ON "agent_inference_shadow_reviews"("agent_id", "status", "updated_at");

-- AddForeignKey
ALTER TABLE "agent_inference_shadow_reviews"
  ADD CONSTRAINT "agent_inference_shadow_reviews_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
