-- Drift cleanup migration (extracted from T-209 auto-generated migration).
-- Brings the local dev DB back in line with the prisma schema after pgvector
-- was installed. Strictly drift-only; no T-209 cue tables here (those live in
-- 20260425142342_t209_cue_programming_v1).
--
-- Affected tables / columns:
--   media_embedding_snapshots.embedding_vector  Text -> vector(1024)
--   media_import_job_items.updated_at           DROP DEFAULT
--   media_import_jobs.updated_at                DROP DEFAULT
--   media_retrieval_documents.updated_at        DROP DEFAULT
--
-- Prerequisite: CREATE EXTENSION vector must be enabled on the target DB.

-- AlterTable
-- USING clause needed because Postgres cannot auto-cast TEXT to vector(1024).
-- Local dev table is empty; production already has vector(1024) so this is
-- only relevant for environments where pgvector was unavailable previously.
ALTER TABLE "media_embedding_snapshots" ALTER COLUMN "embedding_vector" SET DATA TYPE vector(1024) USING embedding_vector::vector(1024);

-- AlterTable
ALTER TABLE "media_import_job_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "media_import_jobs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "media_retrieval_documents" ALTER COLUMN "updated_at" DROP DEFAULT;
