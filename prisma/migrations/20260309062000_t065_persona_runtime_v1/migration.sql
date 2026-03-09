-- CreateTable
CREATE TABLE "agent_persona_states" (
    "agent_id" TEXT NOT NULL,
    "current_vector_json" JSONB NOT NULL,
    "anchor_vector_json" JSONB NOT NULL,
    "maturity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "drift_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_render_decision_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "agent_persona_states_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_active_overlays" (
    "agent_id" TEXT NOT NULL,
    "overlay_code" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "remaining_turns" INTEGER NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "cooldown_until" TIMESTAMP(3) NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "cause_type" TEXT NOT NULL,
    "cause_ref_id" TEXT,
    "rng_seed" TEXT NOT NULL,
    "sampled_atoms_json" JSONB NOT NULL,
    "delta_json" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_active_overlays_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "agent_persona_delta_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref" TEXT,
    "scene" TEXT,
    "salience" DOUBLE PRECISION NOT NULL,
    "raw_delta_json" JSONB NOT NULL,
    "applied_delta_json" JSONB NOT NULL,
    "writeback_applied" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_persona_delta_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_active_overlays_expires_at_idx" ON "agent_active_overlays"("expires_at");

-- CreateIndex
CREATE INDEX "agent_active_overlays_cooldown_until_idx" ON "agent_active_overlays"("cooldown_until");

-- CreateIndex
CREATE INDEX "agent_persona_delta_logs_agent_id_created_at_idx" ON "agent_persona_delta_logs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_persona_delta_logs_agent_id_source_type_created_at_idx" ON "agent_persona_delta_logs"("agent_id", "source_type", "created_at");

-- AddForeignKey
ALTER TABLE "agent_persona_states" ADD CONSTRAINT "agent_persona_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_active_overlays" ADD CONSTRAINT "agent_active_overlays_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_persona_delta_logs" ADD CONSTRAINT "agent_persona_delta_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
