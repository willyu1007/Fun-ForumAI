-- T-932 invite code seed registration
-- Adds fixed reusable invite codes and gates new registrations behind them.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteCodeStatus') THEN
    CREATE TYPE "InviteCodeStatus" AS ENUM ('ACTIVE', 'DISABLED');
  END IF;
END $$;

ALTER TABLE "human_users"
  ADD COLUMN IF NOT EXISTS "invite_code_id" TEXT;

CREATE TABLE IF NOT EXISTS "invite_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "InviteCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "max_uses" INTEGER NOT NULL DEFAULT 500,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_code_key"
  ON "invite_codes"("code");

CREATE INDEX IF NOT EXISTS "human_users_invite_code_id_idx"
  ON "human_users"("invite_code_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'human_users_invite_code_id_fkey'
      AND table_name = 'human_users'
  ) THEN
    ALTER TABLE "human_users"
      ADD CONSTRAINT "human_users_invite_code_id_fkey"
      FOREIGN KEY ("invite_code_id") REFERENCES "invite_codes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "invite_codes" ("id", "code", "status", "max_uses", "used_count", "note")
VALUES
  ('invite-seed-100001', '100001', 'ACTIVE', 500, 0, '灰测种子邀请码 01'),
  ('invite-seed-100002', '100002', 'ACTIVE', 500, 0, '灰测种子邀请码 02'),
  ('invite-seed-100003', '100003', 'ACTIVE', 500, 0, '灰测种子邀请码 03'),
  ('invite-seed-100004', '100004', 'ACTIVE', 500, 0, '灰测种子邀请码 04'),
  ('invite-seed-100005', '100005', 'ACTIVE', 500, 0, '灰测种子邀请码 05'),
  ('invite-seed-100006', '100006', 'ACTIVE', 500, 0, '灰测种子邀请码 06'),
  ('invite-seed-100007', '100007', 'ACTIVE', 500, 0, '灰测种子邀请码 07'),
  ('invite-seed-100008', '100008', 'ACTIVE', 500, 0, '灰测种子邀请码 08'),
  ('invite-seed-100009', '100009', 'ACTIVE', 500, 0, '灰测种子邀请码 09'),
  ('invite-seed-100010', '100010', 'ACTIVE', 500, 0, '灰测种子邀请码 10')
ON CONFLICT ("code") DO NOTHING;
