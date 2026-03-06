CREATE OR REPLACE FUNCTION jsonb_deep_merge_config(base_value jsonb, patch_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := COALESCE(base_value, '{}'::jsonb);
  entry record;
BEGIN
  IF jsonb_typeof(COALESCE(base_value, 'null'::jsonb)) <> 'object'
     OR jsonb_typeof(COALESCE(patch_value, 'null'::jsonb)) <> 'object' THEN
    RETURN COALESCE(patch_value, base_value);
  END IF;

  FOR entry IN SELECT key, value FROM jsonb_each(COALESCE(patch_value, '{}'::jsonb))
  LOOP
    IF jsonb_typeof(result -> entry.key) = 'object' AND jsonb_typeof(entry.value) = 'object' THEN
      result := jsonb_set(
        result,
        ARRAY[entry.key],
        jsonb_deep_merge_config(result -> entry.key, entry.value),
        true
      );
    ELSE
      result := jsonb_set(result, ARRAY[entry.key], entry.value, true);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_community_config_json(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  legacy_stage_keys text[] := ARRAY[
    'version',
    'min_tier_pool',
    'roles',
    'tier_gate',
    'strict_t4',
    'aftershow',
    'allocator',
    'human_participation',
    'incubation',
    'moderation'
  ];
  normalized jsonb := COALESCE(raw, '{}'::jsonb);
  legacy_stage jsonb := '{}'::jsonb;
  stage_value jsonb;
  legacy_key text;
BEGIN
  -- stage_spec_v1 remains the canonical persisted shape.
  -- Legacy top-level stage keys only fill missing subtrees and are then removed;
  -- they never override conflicting values already stored under stage_spec_v1.
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(raw) <> 'object' THEN
    RETURN raw;
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, raw -> key), '{}'::jsonb)
  INTO legacy_stage
  FROM unnest(legacy_stage_keys) AS key
  WHERE raw ? key;

  normalized := normalized - 'stage_spec_v1';
  FOREACH legacy_key IN ARRAY legacy_stage_keys
  LOOP
    normalized := normalized - legacy_key;
  END LOOP;

  IF raw ? 'stage_spec_v1' THEN
    stage_value := raw -> 'stage_spec_v1';
    IF jsonb_typeof(stage_value) = 'object' AND legacy_stage <> '{}'::jsonb THEN
      normalized := jsonb_set(
        normalized,
        '{stage_spec_v1}',
        jsonb_deep_merge_config(legacy_stage, stage_value),
        true
      );
    ELSE
      normalized := jsonb_set(normalized, '{stage_spec_v1}', stage_value, true);
    END IF;
  ELSIF legacy_stage <> '{}'::jsonb THEN
    normalized := jsonb_set(normalized, '{stage_spec_v1}', legacy_stage, true);
  END IF;

  RETURN normalized;
END;
$$;

UPDATE "communities"
SET "rules_json" = normalize_community_config_json("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_config_json("rules_json");

UPDATE "community_config_versions"
SET "rules_json" = normalize_community_config_json("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_config_json("rules_json");

WITH normalized AS (
  SELECT
    "id",
    normalize_community_config_json("patch_json") AS normalized_patch_json,
    CASE
      WHEN "proposed_rules_json" IS NULL THEN NULL
      ELSE normalize_community_config_json("proposed_rules_json")
    END AS normalized_proposed_rules_json
  FROM "community_config_patches"
)
UPDATE "community_config_patches" AS patch
SET
  "patch_json" = normalized.normalized_patch_json,
  "proposed_rules_json" = normalized.normalized_proposed_rules_json,
  "risk_level" = CASE
    WHEN patch."risk_level" = 'HIGH' THEN 'HIGH'::"ConfigRiskLevel"
    WHEN normalized.normalized_patch_json ? 'stage_spec_v1' THEN 'HIGH'::"ConfigRiskLevel"
    WHEN normalized.normalized_patch_json ? 'notifications' THEN 'HIGH'::"ConfigRiskLevel"
    ELSE 'LOW'::"ConfigRiskLevel"
  END
FROM normalized
WHERE patch."id" = normalized."id"
  AND (
    patch."patch_json" IS DISTINCT FROM normalized.normalized_patch_json
    OR patch."proposed_rules_json" IS DISTINCT FROM normalized.normalized_proposed_rules_json
    OR patch."risk_level" IS DISTINCT FROM CASE
      WHEN patch."risk_level" = 'HIGH' THEN 'HIGH'::"ConfigRiskLevel"
      WHEN normalized.normalized_patch_json ? 'stage_spec_v1' THEN 'HIGH'::"ConfigRiskLevel"
      WHEN normalized.normalized_patch_json ? 'notifications' THEN 'HIGH'::"ConfigRiskLevel"
      ELSE 'LOW'::"ConfigRiskLevel"
    END
  );
