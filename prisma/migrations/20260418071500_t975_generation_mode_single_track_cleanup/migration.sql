-- Normalize legacy candidate generation_mode residue into the single-track kickoff + runtime-only warmup model.

UPDATE "posts"
SET "generation_mode" = 'kickoff_import'
WHERE "generation_mode" = 'kickoff_candidate';

UPDATE "posts"
SET "generation_mode" = 'warmup_runtime'
WHERE "generation_mode" IN ('warmup_candidate', 'warmup_topup_candidate');

UPDATE "public_stage_threads"
SET "generation_mode" = 'kickoff_import'
WHERE "generation_mode" = 'kickoff_candidate';

UPDATE "public_stage_threads"
SET "generation_mode" = 'warmup_runtime'
WHERE "generation_mode" IN ('warmup_candidate', 'warmup_topup_candidate');

UPDATE "public_stage_turns"
SET "generation_mode" = 'kickoff_import'
WHERE "generation_mode" = 'kickoff_candidate';

UPDATE "public_stage_turns"
SET "generation_mode" = 'warmup_runtime'
WHERE "generation_mode" IN ('warmup_candidate', 'warmup_topup_candidate');

UPDATE "post_media"
SET "generation_mode" = 'kickoff_import'
WHERE "generation_mode" = 'kickoff_candidate';

UPDATE "post_media"
SET "generation_mode" = 'warmup_runtime'
WHERE "generation_mode" IN ('warmup_candidate', 'warmup_topup_candidate');

UPDATE "media_lineage_edges"
SET "generation_mode" = 'kickoff_import'
WHERE "generation_mode" = 'kickoff_candidate';

UPDATE "media_lineage_edges"
SET "generation_mode" = 'warmup_runtime'
WHERE "generation_mode" IN ('warmup_candidate', 'warmup_topup_candidate');
