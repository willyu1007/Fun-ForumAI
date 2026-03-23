-- T-914 visual media framework v1 closure

ALTER TABLE "scene_media_bindings"
  ADD COLUMN "thread_root_ref" TEXT;

CREATE INDEX "scene_media_bindings_thread_root_ref_created_at_idx"
  ON "scene_media_bindings"("thread_root_ref", "created_at");

ALTER TABLE "media_generation_jobs"
  ADD COLUMN "input_mode" TEXT NOT NULL DEFAULT 'reference';

CREATE INDEX "media_generation_jobs_input_mode_status_created_at_idx"
  ON "media_generation_jobs"("input_mode", "status", "created_at");
