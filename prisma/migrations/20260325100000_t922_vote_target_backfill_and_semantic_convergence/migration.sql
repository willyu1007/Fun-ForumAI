-- T-922 vote target backfill and semantic convergence
-- Assumes T-916/T-919 have already created public_stage_* tables and thread/turn sidecar columns.
-- This migration:
--   1. backfills public stage threads/turns from legacy comments using stable IDs
--   2. upgrades forum_scene_metadata(+archive) rows from COMMENT to THREAD/TURN
--   3. upgrades VoteTarget/HumanVoteTarget enums and remaps historical COMMENT votes

-- 1. Backfill top-level comments -> public_stage_threads
INSERT INTO "public_stage_threads" (
  "id",
  "post_id",
  "community_id",
  "author_agent_id",
  "body",
  "visibility",
  "state",
  "thread_state",
  "reply_budget",
  "active_route_json",
  "created_at",
  "updated_at"
)
SELECT
  c."id",
  c."post_id",
  p."community_id",
  c."author_agent_id",
  c."body",
  c."visibility",
  c."state",
  'OPEN'::"PublicStageThreadState",
  6,
  NULL,
  c."created_at",
  c."updated_at"
FROM "comments" c
JOIN "posts" p
  ON p."id" = c."post_id"
LEFT JOIN "public_stage_threads" pst
  ON pst."id" = c."id"
WHERE c."parent_comment_id" IS NULL
  AND pst."id" IS NULL;

-- 2. Backfill reply comments -> public_stage_turns
WITH RECURSIVE "comment_roots" AS (
  SELECT
    c."id",
    c."post_id",
    c."parent_comment_id",
    c."id" AS "root_comment_id"
  FROM "comments" c
  WHERE c."parent_comment_id" IS NULL

  UNION ALL

  SELECT
    child."id",
    child."post_id",
    child."parent_comment_id",
    roots."root_comment_id"
  FROM "comments" child
  JOIN "comment_roots" roots
    ON child."parent_comment_id" = roots."id"
),
"reply_comments" AS (
  SELECT
    c."id",
    c."post_id",
    roots."root_comment_id" AS "thread_id",
    c."author_agent_id",
    c."body",
    c."visibility",
    c."state",
    c."created_at",
    c."updated_at",
    CASE
      WHEN parent."parent_comment_id" IS NULL THEN NULL
      ELSE c."parent_comment_id"
    END AS "anchor_turn_id",
    ROW_NUMBER() OVER (
      PARTITION BY roots."root_comment_id"
      ORDER BY c."created_at", c."id"
    ) AS "turn_index"
  FROM "comments" c
  JOIN "comment_roots" roots
    ON roots."id" = c."id"
  JOIN "comments" parent
    ON parent."id" = c."parent_comment_id"
  LEFT JOIN "public_stage_turns" existing
    ON existing."id" = c."id"
  WHERE c."parent_comment_id" IS NOT NULL
    AND existing."id" IS NULL
)
INSERT INTO "public_stage_turns" (
  "id",
  "thread_id",
  "post_id",
  "author_agent_id",
  "turn_index",
  "anchor_turn_id",
  "anchor_intent",
  "quoted_excerpt",
  "body",
  "visibility",
  "state",
  "created_at",
  "updated_at"
)
SELECT
  reply."id",
  reply."thread_id",
  reply."post_id",
  reply."author_agent_id",
  reply."turn_index",
  reply."anchor_turn_id",
  NULL,
  NULL,
  reply."body",
  reply."visibility",
  reply."state",
  reply."created_at",
  reply."updated_at"
FROM "reply_comments" reply;

-- 3. Upgrade forum_scene_metadata rows from COMMENT to THREAD/TURN
-- THREAD metadata owns thread_id; TURN metadata owns turn_id only.
UPDATE "forum_scene_metadata" fsm
SET
  "target_type" = 'THREAD',
  "thread_id" = fsm."comment_id",
  "turn_id" = NULL
FROM "comments" c
WHERE fsm."target_type" = 'COMMENT'
  AND fsm."comment_id" = c."id"
  AND c."parent_comment_id" IS NULL;

WITH RECURSIVE "comment_roots" AS (
  SELECT
    c."id",
    c."parent_comment_id",
    c."id" AS "root_comment_id"
  FROM "comments" c
  WHERE c."parent_comment_id" IS NULL

  UNION ALL

  SELECT
    child."id",
    child."parent_comment_id",
    roots."root_comment_id"
  FROM "comments" child
  JOIN "comment_roots" roots
    ON child."parent_comment_id" = roots."id"
)
UPDATE "forum_scene_metadata" fsm
SET
  "target_type" = 'TURN',
  "thread_id" = NULL,
  "turn_id" = fsm."comment_id"
FROM "comments" c
JOIN "comment_roots" roots
  ON roots."id" = c."id"
WHERE fsm."target_type" = 'COMMENT'
  AND fsm."comment_id" = c."id"
  AND c."parent_comment_id" IS NOT NULL;

-- 4. Upgrade forum_scene_metadata_archive rows from COMMENT to THREAD/TURN
UPDATE "forum_scene_metadata_archive" fsma
SET
  "target_type" = 'THREAD',
  "thread_id" = fsma."comment_id",
  "turn_id" = NULL
FROM "comments" c
WHERE fsma."target_type" = 'COMMENT'
  AND fsma."comment_id" = c."id"
  AND c."parent_comment_id" IS NULL;

WITH RECURSIVE "comment_roots" AS (
  SELECT
    c."id",
    c."parent_comment_id",
    c."id" AS "root_comment_id"
  FROM "comments" c
  WHERE c."parent_comment_id" IS NULL

  UNION ALL

  SELECT
    child."id",
    child."parent_comment_id",
    roots."root_comment_id"
  FROM "comments" child
  JOIN "comment_roots" roots
    ON child."parent_comment_id" = roots."id"
)
UPDATE "forum_scene_metadata_archive" fsma
SET
  "target_type" = 'TURN',
  "thread_id" = NULL,
  "turn_id" = fsma."comment_id"
FROM "comments" c
JOIN "comment_roots" roots
  ON roots."id" = c."id"
WHERE fsma."target_type" = 'COMMENT'
  AND fsma."comment_id" = c."id"
  AND c."parent_comment_id" IS NOT NULL;

-- 5. Upgrade VoteTarget enum and historical votes
DO $$
DECLARE
  vote_labels text[];
BEGIN
  SELECT ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)
    INTO vote_labels
  FROM pg_type t
  JOIN pg_enum e
    ON e.enumtypid = t.oid
  WHERE t.typname = 'VoteTarget';

  IF vote_labels = ARRAY['POST', 'COMMENT', 'MESSAGE'] THEN
    ALTER TABLE "votes"
      ALTER COLUMN "target_type" TYPE text USING "target_type"::text;

    UPDATE "votes" v
    SET "target_type" = CASE
      WHEN c."parent_comment_id" IS NULL THEN 'THREAD'
      ELSE 'TURN'
    END
    FROM "comments" c
    WHERE v."target_type" = 'COMMENT'
      AND v."target_id" = c."id";

    UPDATE "votes"
    SET "target_type" = 'TURN'
    WHERE "target_type" = 'COMMENT';

    CREATE TYPE "VoteTarget_new" AS ENUM ('POST', 'THREAD', 'TURN', 'MESSAGE');

    ALTER TABLE "votes"
      ALTER COLUMN "target_type" TYPE "VoteTarget_new"
      USING "target_type"::"VoteTarget_new";

    DROP TYPE "VoteTarget";
    ALTER TYPE "VoteTarget_new" RENAME TO "VoteTarget";
  END IF;
END $$;

-- 6. Upgrade HumanVoteTarget enum and historical human votes
DO $$
DECLARE
  human_vote_labels text[];
BEGIN
  SELECT ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder)
    INTO human_vote_labels
  FROM pg_type t
  JOIN pg_enum e
    ON e.enumtypid = t.oid
  WHERE t.typname = 'HumanVoteTarget';

  IF human_vote_labels = ARRAY['POST', 'COMMENT'] THEN
    ALTER TABLE "human_votes"
      ALTER COLUMN "target_type" TYPE text USING "target_type"::text;

    UPDATE "human_votes" hv
    SET "target_type" = CASE
      WHEN c."parent_comment_id" IS NULL THEN 'THREAD'
      ELSE 'TURN'
    END
    FROM "comments" c
    WHERE hv."target_type" = 'COMMENT'
      AND hv."target_id" = c."id";

    UPDATE "human_votes"
    SET "target_type" = 'TURN'
    WHERE "target_type" = 'COMMENT';

    CREATE TYPE "HumanVoteTarget_new" AS ENUM ('POST', 'THREAD', 'TURN');

    ALTER TABLE "human_votes"
      ALTER COLUMN "target_type" TYPE "HumanVoteTarget_new"
      USING "target_type"::"HumanVoteTarget_new";

    DROP TYPE "HumanVoteTarget";
    ALTER TYPE "HumanVoteTarget_new" RENAME TO "HumanVoteTarget";
  END IF;
END $$;
