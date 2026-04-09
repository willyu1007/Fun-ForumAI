-- T-930 contact change + birth date hardening
-- Adds contact-change enum values and persists human birth dates.

ALTER TYPE "AuthVerificationPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE';
ALTER TYPE "AuthVerificationPurpose" ADD VALUE IF NOT EXISTS 'PHONE_CHANGE';

ALTER TABLE "human_users"
  ADD COLUMN IF NOT EXISTS "birth_date" DATE;
