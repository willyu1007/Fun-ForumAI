CREATE OR REPLACE FUNCTION normalize_stage_spec_v1_creator_cutover(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized jsonb := COALESCE(raw, '{}'::jsonb);
  tier_gate jsonb := COALESCE(normalized -> 'tier_gate', '{}'::jsonb);
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(raw) <> 'object' THEN
    RETURN raw;
  END IF;

  IF normalized ? 'strict_t4'
     AND jsonb_typeof(normalized -> 'strict_t4') = 'object'
     AND NOT (normalized ? 'strict_publication') THEN
    normalized := jsonb_set(
      normalized,
      '{strict_publication}',
      normalized -> 'strict_t4',
      true
    );
  END IF;

  normalized := normalized - 'strict_t4';

  IF jsonb_typeof(tier_gate) = 'object'
     AND tier_gate ? 't4_longform_min_tier'
     AND NOT (tier_gate ? 'strict_publication_longform_min_tier') THEN
    tier_gate := jsonb_set(
      tier_gate,
      '{strict_publication_longform_min_tier}',
      tier_gate -> 't4_longform_min_tier',
      true
    );
  END IF;

  IF jsonb_typeof(tier_gate) = 'object' THEN
    tier_gate := tier_gate - 't4_longform_min_tier';
    normalized := jsonb_set(normalized, '{tier_gate}', tier_gate, true);
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_community_rules_creator_cutover(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized jsonb := COALESCE(raw, '{}'::jsonb);
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(raw) <> 'object' THEN
    RETURN raw;
  END IF;

  IF normalized ? 'stage_spec_v1' THEN
    normalized := jsonb_set(
      normalized,
      '{stage_spec_v1}',
      normalize_stage_spec_v1_creator_cutover(normalized -> 'stage_spec_v1'),
      true
    );
  END IF;

  RETURN normalized;
END;
$$;

UPDATE "communities"
SET "rules_json" = normalize_community_rules_creator_cutover("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_rules_creator_cutover("rules_json");

UPDATE "community_config_versions"
SET "rules_json" = normalize_community_rules_creator_cutover("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_rules_creator_cutover("rules_json");

UPDATE "community_config_patches"
SET
  "patch_json" = normalize_community_rules_creator_cutover("patch_json"),
  "proposed_rules_json" = CASE
    WHEN "proposed_rules_json" IS NULL THEN NULL
    ELSE normalize_community_rules_creator_cutover("proposed_rules_json")
  END
WHERE (
    "patch_json" IS NOT NULL
    AND "patch_json" IS DISTINCT FROM normalize_community_rules_creator_cutover("patch_json")
  )
  OR (
    "proposed_rules_json" IS NOT NULL
    AND "proposed_rules_json" IS DISTINCT FROM normalize_community_rules_creator_cutover("proposed_rules_json")
  );

DO $$
DECLARE
  pair record;
  legacy_id text;
  canonical_id text;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      ('t4-picks', 'creator-recommendation'),
      ('t4-relations', 'creator-relationship')
    ) AS creator_pairs(legacy_slug, canonical_slug)
  LOOP
    SELECT "id"
    INTO legacy_id
    FROM "communities"
    WHERE "slug" = pair.legacy_slug;

    IF legacy_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT "id"
    INTO canonical_id
    FROM "communities"
    WHERE "slug" = pair.canonical_slug;

    IF canonical_id IS NULL THEN
      UPDATE "communities"
      SET
        "slug" = pair.canonical_slug,
        "rules_json" = normalize_community_rules_creator_cutover("rules_json")
      WHERE "id" = legacy_id;

      UPDATE "community_search_docs"
      SET "slug" = pair.canonical_slug
      WHERE "community_id" = legacy_id;

      UPDATE "post_search_docs"
      SET "community_slug" = pair.canonical_slug
      WHERE "community_id" = legacy_id;

      UPDATE "thread_search_docs"
      SET "community_slug" = pair.canonical_slug
      WHERE "community_id" = legacy_id;

      CONTINUE;
    END IF;

    IF canonical_id = legacy_id THEN
      CONTINUE;
    END IF;

    DELETE FROM "agent_community_memberships" AS legacy
    WHERE legacy."community_id" = legacy_id
      AND EXISTS (
        SELECT 1
        FROM "agent_community_memberships" AS canonical
        WHERE canonical."community_id" = canonical_id
          AND canonical."agent_id" = legacy."agent_id"
          AND canonical."left_at" IS NULL
      );

    UPDATE "agent_community_memberships"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    DELETE FROM "community_culture_digests" AS legacy
    WHERE legacy."community_id" = legacy_id
      AND EXISTS (
        SELECT 1
        FROM "community_culture_digests" AS canonical
        WHERE canonical."community_id" = canonical_id
          AND canonical."version" = legacy."version"
      );

    UPDATE "community_culture_digests"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    DELETE FROM "community_config_versions" AS legacy
    WHERE legacy."community_id" = legacy_id
      AND EXISTS (
        SELECT 1
        FROM "community_config_versions" AS canonical
        WHERE canonical."community_id" = canonical_id
          AND canonical."version" = legacy."version"
      );

    UPDATE "community_config_versions"
    SET
      "community_id" = canonical_id,
      "rules_json" = normalize_community_rules_creator_cutover("rules_json")
    WHERE "community_id" = legacy_id;

    UPDATE "community_config_patches"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "posts"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "events"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "public_stage_threads"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "incubation_jobs"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "audience_threads"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "aftershow_runs"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "audience_summaries"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "aftershow_artifacts"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "role_assignments"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "forum_scene_metadata"
    SET "community_id" = canonical_id
    WHERE "community_id" = legacy_id;

    UPDATE "community_proposals"
    SET "source_community_id" = canonical_id
    WHERE "source_community_id" = legacy_id;

    UPDATE "community_proposals"
    SET "resulting_community_id" = canonical_id
    WHERE "resulting_community_id" = legacy_id;

    UPDATE "community_proposals"
    SET "merged_into_community_id" = canonical_id
    WHERE "merged_into_community_id" = legacy_id;

    UPDATE "community_merge_recommendations"
    SET "duplicate_of_community_id" = canonical_id
    WHERE "duplicate_of_community_id" = legacy_id;

    UPDATE "community_merge_recommendations"
    SET "recommended_as_lane_community_id" = canonical_id
    WHERE "recommended_as_lane_community_id" = legacy_id;

    DELETE FROM "community_search_docs"
    WHERE "community_id" = legacy_id;

    DELETE FROM "post_search_docs"
    WHERE "community_id" = legacy_id
       OR "community_slug" = pair.legacy_slug;

    DELETE FROM "thread_search_docs"
    WHERE "community_id" = legacy_id
       OR "community_slug" = pair.legacy_slug;

    DELETE FROM "communities"
    WHERE "id" = legacy_id;
  END LOOP;
END;
$$;
