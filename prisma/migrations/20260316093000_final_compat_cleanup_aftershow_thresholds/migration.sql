ALTER TABLE "aftershow_runs"
  DROP COLUMN IF EXISTS "threshold_min_comments";

ALTER TABLE "aftershow_runs"
  RENAME COLUMN "threshold_min_human_votes" TO "threshold_min_human_vote_score";
