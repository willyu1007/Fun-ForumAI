-- T-930 web auth email + sms registration
-- Adds verification challenge storage and relaxes HumanUser to support
-- phone-only, passwordless accounts while keeping existing email accounts valid.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthVerificationChannel') THEN
    CREATE TYPE "AuthVerificationChannel" AS ENUM ('EMAIL', 'SMS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthVerificationPurpose') THEN
    CREATE TYPE "AuthVerificationPurpose" AS ENUM ('EMAIL_SIGNUP', 'SMS_AUTH');
  END IF;
END $$;

ALTER TABLE "human_users"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "password_hash" DROP NOT NULL;

UPDATE "human_users"
SET "email_verified" = true
WHERE "email" IS NOT NULL
  AND "password_hash" IS NOT NULL
  AND "email_verified" = false;

CREATE TABLE IF NOT EXISTS "auth_verification_challenges" (
  "id" TEXT NOT NULL,
  "channel" "AuthVerificationChannel" NOT NULL,
  "purpose" "AuthVerificationPurpose" NOT NULL,
  "target" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "payload_json" JSONB,
  "requested_from_ip" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "resend_count" INTEGER NOT NULL DEFAULT 0,
  "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_verification_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_verification_challenges_target_purpose_created_at_idx"
  ON "auth_verification_challenges"("target", "purpose", "created_at");

CREATE INDEX IF NOT EXISTS "auth_verification_challenges_requested_from_ip_created_at_idx"
  ON "auth_verification_challenges"("requested_from_ip", "created_at");

CREATE INDEX IF NOT EXISTS "auth_verification_challenges_purpose_consumed_at_expires_at_idx"
  ON "auth_verification_challenges"("purpose", "consumed_at", "expires_at");
