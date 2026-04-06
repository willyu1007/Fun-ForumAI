CREATE OR REPLACE FUNCTION normalize_stage_spec_v1_residual_cleanup(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized jsonb := COALESCE(raw, '{}'::jsonb);
  roles jsonb := COALESCE(normalized -> 'roles', '{}'::jsonb);
  cleaned_roles jsonb;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(raw) <> 'object' THEN
    RETURN raw;
  END IF;

  IF jsonb_typeof(roles) = 'object' THEN
    SELECT COALESCE(
      jsonb_object_agg(
        role_key,
        CASE
          WHEN jsonb_typeof(role_value) = 'object' THEN role_value - 't4_longform_only'
          ELSE role_value
        END
      ),
      '{}'::jsonb
    )
    INTO cleaned_roles
    FROM jsonb_each(roles) AS role_entries(role_key, role_value);

    normalized := jsonb_set(normalized, '{roles}', cleaned_roles, true);
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_community_rules_residual_cleanup(raw jsonb)
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
      normalize_stage_spec_v1_residual_cleanup(normalized -> 'stage_spec_v1'),
      true
    );
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_launch_system_identity_residual_cleanup(raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized jsonb := COALESCE(raw, '{}'::jsonb);
  identity jsonb := normalized -> 'launch_system_identity';
  format_capabilities jsonb := '[]'::jsonb;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(raw) <> 'object' THEN
    RETURN raw;
  END IF;

  IF identity IS NULL OR jsonb_typeof(identity) <> 'object' THEN
    RETURN raw;
  END IF;

  IF identity ->> 'program_role' = 't4_blogger' THEN
    identity := jsonb_set(identity, '{program_role}', '"creator"'::jsonb, true);
  END IF;

  IF identity ->> 'identity_role_id' = 't4_blogger' THEN
    identity := jsonb_set(identity, '{identity_role_id}', '"creator"'::jsonb, true);
  END IF;

  IF identity ? 't4_capable' AND identity -> 't4_capable' = 'true'::jsonb THEN
    IF jsonb_typeof(identity -> 'format_capabilities') = 'array' THEN
      format_capabilities := identity -> 'format_capabilities';
    END IF;

    IF NOT (format_capabilities @> '["note"]'::jsonb) THEN
      format_capabilities := format_capabilities || '["note"]'::jsonb;
    END IF;

    identity := jsonb_set(identity, '{format_capabilities}', format_capabilities, true);
  END IF;

  identity := identity - 't4_capable';
  normalized := jsonb_set(normalized, '{launch_system_identity}', identity, true);
  RETURN normalized;
END;
$$;

UPDATE "communities"
SET "rules_json" = normalize_community_rules_residual_cleanup("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_rules_residual_cleanup("rules_json");

UPDATE "community_config_versions"
SET "rules_json" = normalize_community_rules_residual_cleanup("rules_json")
WHERE "rules_json" IS NOT NULL
  AND "rules_json" IS DISTINCT FROM normalize_community_rules_residual_cleanup("rules_json");

UPDATE "community_config_patches"
SET
  "patch_json" = normalize_community_rules_residual_cleanup("patch_json"),
  "proposed_rules_json" = CASE
    WHEN "proposed_rules_json" IS NULL THEN NULL
    ELSE normalize_community_rules_residual_cleanup("proposed_rules_json")
  END
WHERE (
    "patch_json" IS NOT NULL
    AND "patch_json" IS DISTINCT FROM normalize_community_rules_residual_cleanup("patch_json")
  )
  OR (
    "proposed_rules_json" IS NOT NULL
    AND "proposed_rules_json" IS DISTINCT FROM normalize_community_rules_residual_cleanup("proposed_rules_json")
  );

UPDATE "agent_configs"
SET "config_json" = normalize_launch_system_identity_residual_cleanup("config_json")
WHERE "config_json" IS NOT NULL
  AND "config_json" IS DISTINCT FROM normalize_launch_system_identity_residual_cleanup("config_json");
