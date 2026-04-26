-- T-214 A-M1 cue-auto-editor — trigger event log.
-- One append-only row per detected trigger window. `dedup_key` is unique so
-- multiple ticks within the same window resolve to a single row. Downstream
-- LLM output (if any) lands in `public_discussion_cue_changes` with
-- `trigger_id` set to this row's id.

-- CreateEnum
CREATE TYPE "AutoEditorTriggerType" AS ENUM (
  'COMMUNITY_LULL',
  'SUPPLY_FLOOR_GAP',
  'EVENING_DISCUSSION_GAP',
  'FATIGUE_HIGH',
  'MEDIA_OPPORTUNITY',
  'GLOBAL_RUNTIME_IDLE'
);

-- CreateEnum
CREATE TYPE "AutoEditorTriggerSeverity" AS ENUM (
  'LOW',
  'STANDARD',
  'HIGH'
);

-- CreateEnum
CREATE TYPE "AutoEditorTriggerSource" AS ENUM (
  'SCAN',
  'EVENT'
);

-- CreateTable
CREATE TABLE "auto_editor_trigger_events" (
    "id" TEXT NOT NULL,
    "community_id" TEXT,
    "trigger_type" "AutoEditorTriggerType" NOT NULL,
    "severity" "AutoEditorTriggerSeverity" NOT NULL,
    "source" "AutoEditorTriggerSource" NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_editor_trigger_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_editor_trigger_events_dedup_key_key"
  ON "auto_editor_trigger_events"("dedup_key");

-- CreateIndex
CREATE INDEX "auto_editor_trigger_events_community_id_detected_at_idx"
  ON "auto_editor_trigger_events"("community_id", "detected_at");

-- CreateIndex
CREATE INDEX "auto_editor_trigger_events_trigger_type_detected_at_idx"
  ON "auto_editor_trigger_events"("trigger_type", "detected_at");
