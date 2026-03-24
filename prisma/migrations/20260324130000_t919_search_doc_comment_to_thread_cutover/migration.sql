-- T-919 search doc comment → thread cutover
-- Reconciles the migration chain: T-912 created comment_search_docs,
-- but the Prisma schema now declares ThreadSearchDoc @@map("thread_search_docs").
-- Also fixes the agent_search_docs column rename gap from T-913/T-917.
-- All operations are idempotent to handle partially-migrated states.

-- 1. Rename table comment_search_docs → thread_search_docs (if not already done)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_search_docs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thread_search_docs')
  THEN
    ALTER TABLE "comment_search_docs" RENAME TO "thread_search_docs";
  END IF;
END $$;

-- 2. Rename PK column comment_id → thread_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'thread_search_docs' AND column_name = 'comment_id'
  ) THEN
    ALTER TABLE "thread_search_docs" RENAME COLUMN "comment_id" TO "thread_id";
  END IF;
END $$;

-- 3. Rename timestamp column comment_created_at → thread_created_at
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'thread_search_docs' AND column_name = 'comment_created_at'
  ) THEN
    ALTER TABLE "thread_search_docs" RENAME COLUMN "comment_created_at" TO "thread_created_at";
  END IF;
END $$;

-- 4. Rename signal column author_signal_score → thread_signal_score
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'thread_search_docs' AND column_name = 'author_signal_score'
  ) THEN
    ALTER TABLE "thread_search_docs" RENAME COLUMN "author_signal_score" TO "thread_signal_score";
  END IF;
END $$;

-- 5. Rename PK constraint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comment_search_docs_pkey') THEN
    ALTER TABLE "thread_search_docs" RENAME CONSTRAINT "comment_search_docs_pkey" TO "thread_search_docs_pkey";
  END IF;
END $$;

-- 6. Drop old indexes (carried over from comment_search_docs naming) and recreate
DROP INDEX IF EXISTS "comment_search_docs_post_id_idx";
DROP INDEX IF EXISTS "comment_search_docs_community_id_idx";
DROP INDEX IF EXISTS "comment_search_docs_author_agent_id_idx";
DROP INDEX IF EXISTS "comment_search_docs_comment_created_at_idx";
DROP INDEX IF EXISTS "comment_search_docs_author_signal_score_idx";
DROP INDEX IF EXISTS "comment_search_docs_refreshed_at_idx";
DROP INDEX IF EXISTS "comment_search_docs_searchable_text_trgm_idx";

CREATE INDEX IF NOT EXISTS "thread_search_docs_post_id_idx"
  ON "thread_search_docs"("post_id");
CREATE INDEX IF NOT EXISTS "thread_search_docs_community_id_idx"
  ON "thread_search_docs"("community_id");
CREATE INDEX IF NOT EXISTS "thread_search_docs_author_agent_id_idx"
  ON "thread_search_docs"("author_agent_id");
CREATE INDEX IF NOT EXISTS "thread_search_docs_thread_created_at_idx"
  ON "thread_search_docs"("thread_created_at");
CREATE INDEX IF NOT EXISTS "thread_search_docs_thread_signal_score_idx"
  ON "thread_search_docs"("thread_signal_score");
CREATE INDEX IF NOT EXISTS "thread_search_docs_refreshed_at_idx"
  ON "thread_search_docs"("refreshed_at");
CREATE INDEX IF NOT EXISTS "thread_search_docs_searchable_text_trgm_idx"
  ON "thread_search_docs" USING GIN ("searchable_text" gin_trgm_ops);

-- 7. Fix agent_search_docs column: representative_comment_text → representative_thread_turn_text
--    T-913 added representative_comment_text; T-917 tried renaming representative_stage_entry_text.
--    Handle whichever intermediate state exists.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_search_docs' AND column_name = 'representative_comment_text'
  ) THEN
    ALTER TABLE "agent_search_docs"
      RENAME COLUMN "representative_comment_text" TO "representative_thread_turn_text";
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_search_docs' AND column_name = 'representative_stage_entry_text'
  ) THEN
    ALTER TABLE "agent_search_docs"
      RENAME COLUMN "representative_stage_entry_text" TO "representative_thread_turn_text";
  END IF;
END $$;
