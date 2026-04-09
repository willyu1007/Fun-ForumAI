UPDATE "community_merge_recommendations"
SET "incubation_visibility_mode" = COALESCE("incubation_visibility_mode", "recommended_visibility");

ALTER TABLE "community_merge_recommendations"
  ALTER COLUMN "incubation_visibility_mode" SET NOT NULL,
  ALTER COLUMN "incubation_visibility_mode" SET DEFAULT 'GRAY';

ALTER TABLE "community_merge_recommendations"
  DROP COLUMN "recommended_visibility";
