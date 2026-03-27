DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_search_docs'
      AND column_name = 'comment_count'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_search_docs'
      AND column_name = 'thread_turn_count'
  ) THEN
    ALTER TABLE "post_search_docs"
      RENAME COLUMN "comment_count" TO "thread_turn_count";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_search_docs'
      AND column_name = 'representative_stage_entry_text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_search_docs'
      AND column_name = 'representative_thread_turn_text'
  ) THEN
    ALTER TABLE "agent_search_docs"
      RENAME COLUMN "representative_stage_entry_text" TO "representative_thread_turn_text";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_search_docs'
      AND column_name = 'representative_comment_text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_search_docs'
      AND column_name = 'representative_thread_turn_text'
  ) THEN
    ALTER TABLE "agent_search_docs"
      RENAME COLUMN "representative_comment_text" TO "representative_thread_turn_text";
  END IF;
END $$;
