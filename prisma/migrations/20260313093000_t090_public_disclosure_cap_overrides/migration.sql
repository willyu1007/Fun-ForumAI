CREATE TYPE "DisclosureCapScopeType" AS ENUM ('AGENT', 'COMMUNITY');

CREATE TYPE "PublicDisclosureCapOverrideStatus" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TYPE "PublicDisclosureCapOverrideSource" AS ENUM (
  'MANUAL',
  'OWNER_ENDORSEMENT_PUBLIC',
  'OWNER_PRIVATE_LEAK'
);

CREATE TABLE "public_disclosure_cap_overrides" (
  "id" TEXT NOT NULL,
  "scope_type" "DisclosureCapScopeType" NOT NULL,
  "scope_id" TEXT NOT NULL,
  "cap_level" INTEGER NOT NULL,
  "status" "PublicDisclosureCapOverrideStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "PublicDisclosureCapOverrideSource" NOT NULL,
  "reason" TEXT,
  "linked_case_id" TEXT,
  "linked_risk_event_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "released_by_user_id" TEXT,
  "released_reason" TEXT,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "public_disclosure_cap_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "public_disclosure_cap_overrides_scope_type_scope_id_status_c_idx"
  ON "public_disclosure_cap_overrides"("scope_type", "scope_id", "status", "created_at");

CREATE UNIQUE INDEX "public_disclosure_cap_overrides_active_scope_unique_idx"
  ON "public_disclosure_cap_overrides"("scope_type", "scope_id")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "public_disclosure_cap_overrides_status_created_at_idx"
  ON "public_disclosure_cap_overrides"("status", "created_at");

CREATE INDEX "public_disclosure_cap_overrides_linked_case_id_created_at_idx"
  ON "public_disclosure_cap_overrides"("linked_case_id", "created_at");

CREATE INDEX "public_disclosure_cap_overrides_linked_risk_event_id_created_at_idx"
  ON "public_disclosure_cap_overrides"("linked_risk_event_id", "created_at");
