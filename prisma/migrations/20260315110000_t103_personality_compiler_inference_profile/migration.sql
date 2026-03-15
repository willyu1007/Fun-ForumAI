-- CreateTable
CREATE TABLE "agent_inference_profiles" (
  "agent_id" TEXT NOT NULL,
  "profile_version" INTEGER NOT NULL DEFAULT 1,
  "incumbent_family" TEXT NOT NULL,
  "challenger_family" TEXT,
  "challenger_voice_line_id" TEXT,
  "migration_state" TEXT NOT NULL DEFAULT 'stable',
  "consecutive_lead_windows" INTEGER NOT NULL DEFAULT 0,
  "challenger_score_delta" DOUBLE PRECISION,
  "manual_voice_line_lock" BOOLEAN NOT NULL DEFAULT false,
  "visible_provider_pin" TEXT,
  "visible_model_pin" TEXT,
  "candidate_since" TIMESTAMP(3),
  "shadow_started_at" TIMESTAMP(3),
  "effective_at" TIMESTAMP(3),
  "blocked_at" TIMESTAMP(3),
  "blocked_reason" TEXT,
  "freeze_until" TIMESTAMP(3),
  "last_compiled_at" TIMESTAMP(3) NOT NULL,
  "last_snapshot_json" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "agent_inference_profiles_pkey" PRIMARY KEY ("agent_id")
);

-- CreateIndex
CREATE INDEX "agent_inference_profiles_migration_state_updated_at_idx" ON "agent_inference_profiles"("migration_state", "updated_at");

-- AddForeignKey
ALTER TABLE "agent_inference_profiles" ADD CONSTRAINT "agent_inference_profiles_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
