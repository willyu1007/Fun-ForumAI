-- T-215 B-M1 cue-public-projection — promote `payloadJson.programming.*`
-- cue refs to explicit columns on `forum_scene_metadata`. Additive: existing
-- rows keep payloadJson untouched and the new columns are NULL until the
-- dual-write window completes; the backfill script
-- (`src/backend/scripts/backfill-forum-scene-programming-columns.ts`) will
-- populate columns for existing rows. Reads switch to columns once one full
-- daypart of column writes lands.

-- AlterTable
ALTER TABLE "forum_scene_metadata"
  ADD COLUMN "programming_production_path" TEXT,
  ADD COLUMN "programming_cue_id"          TEXT,
  ADD COLUMN "programming_attempt_id"      TEXT,
  ADD COLUMN "programming_schedule_id"     TEXT,
  ADD COLUMN "programming_source_type"     TEXT;

-- CreateIndex
CREATE INDEX "forum_scene_metadata_programming_cue_id_idx"
  ON "forum_scene_metadata"("programming_cue_id");

-- CreateIndex
CREATE INDEX "forum_scene_metadata_programming_attempt_id_idx"
  ON "forum_scene_metadata"("programming_attempt_id");
