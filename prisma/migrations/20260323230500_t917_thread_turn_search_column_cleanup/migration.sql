-- T-917 thread/turn search column cleanup (idempotent)

-- 1. post_search_docs: comment_count → thread_turn_count
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_search_docs' AND column_name = 'comment_count'
  ) THEN
    ALTER TABLE "post_search_docs" RENAME COLUMN "comment_count" TO "thread_turn_count";
  END IF;
END $$;

-- 2. agent_search_docs: representative_comment_text or representative_stage_entry_text
--    → representative_thread_turn_text
--    T-913 actually created representative_comment_text, not representative_stage_entry_text.
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
