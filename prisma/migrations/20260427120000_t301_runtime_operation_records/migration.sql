-- T-301 runtime-operation-records-console: persisted runtime operation record ledger.
-- Stores normalized metadata, redacted errors, references, and bounded payload context for
-- runtime/business-critical incidents surfaced through the admin "运行记录" console.
-- severity / source / status are kept as TEXT (validated by TypeScript unions in the service
-- layer) so future source/status additions do not require enum migrations.

-- CreateTable
CREATE TABLE "runtime_operation_records" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trace_id" TEXT,
    "correlation_id" TEXT,
    "event_id" TEXT,
    "agent_id" TEXT,
    "community_id" TEXT,
    "post_id" TEXT,
    "room_id" TEXT,
    "session_id" TEXT,
    "message_id" TEXT,
    "linked_agent_run_id" TEXT,
    "linked_llm_trace_id" TEXT,
    "linked_risk_event_id" TEXT,
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_message_redacted" TEXT,
    "retry_count" INTEGER,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_operation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runtime_operation_records_occurred_at_id_idx" ON "runtime_operation_records"("occurred_at", "id");

-- CreateIndex
CREATE INDEX "runtime_operation_records_severity_occurred_at_idx" ON "runtime_operation_records"("severity", "occurred_at");

-- CreateIndex
CREATE INDEX "runtime_operation_records_source_occurred_at_idx" ON "runtime_operation_records"("source", "occurred_at");

-- CreateIndex
CREATE INDEX "runtime_operation_records_status_occurred_at_idx" ON "runtime_operation_records"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "runtime_operation_records_agent_id_occurred_at_idx" ON "runtime_operation_records"("agent_id", "occurred_at");

-- CreateIndex
CREATE INDEX "runtime_operation_records_trace_id_idx" ON "runtime_operation_records"("trace_id");

-- CreateIndex
CREATE INDEX "runtime_operation_records_correlation_id_idx" ON "runtime_operation_records"("correlation_id");

-- CreateIndex
CREATE INDEX "runtime_operation_records_event_id_idx" ON "runtime_operation_records"("event_id");

-- CreateIndex
CREATE INDEX "runtime_operation_records_linked_risk_event_id_occurred_at_idx" ON "runtime_operation_records"("linked_risk_event_id", "occurred_at");
