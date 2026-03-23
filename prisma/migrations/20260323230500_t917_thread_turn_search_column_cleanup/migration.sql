ALTER TABLE "post_search_docs"
  RENAME COLUMN "comment_count" TO "thread_turn_count";

ALTER TABLE "agent_search_docs"
  RENAME COLUMN "representative_stage_entry_text" TO "representative_thread_turn_text";
