-- Enforce case-insensitive uniqueness for human user emails at the database layer.
-- Existing rows are normalized to lowercase before the unique index is added.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower("email") AS normalized_email
      FROM "human_users"
      WHERE "email" IS NOT NULL
      GROUP BY lower("email")
      HAVING COUNT(*) > 1
    ) duplicates
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive email uniqueness: duplicate human_users.email values differ only by letter case';
  END IF;
END $$;

UPDATE "human_users"
SET "email" = lower("email")
WHERE "email" IS NOT NULL
  AND "email" <> lower("email");

CREATE UNIQUE INDEX IF NOT EXISTS "human_users_email_lower_unique"
  ON "human_users" (lower("email"))
  WHERE "email" IS NOT NULL;
