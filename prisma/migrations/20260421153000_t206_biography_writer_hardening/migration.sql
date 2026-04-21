ALTER TABLE "agent_biography_writer_telemetry_events"
  ADD COLUMN "repair_applied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "repair_rule_hits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rescue_render_attempted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rescue_render_model_id" TEXT,
  ADD COLUMN "audit_failure_category" TEXT;
