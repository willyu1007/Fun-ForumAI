# Env Contract Validation

- Timestamp (UTC): `2026-03-07T13:11:26Z`
- Root: `/Volumes/DataDisk/Project/Fun-ForumAI`
- Envs: `dev, prod, staging`
- Status: **PASS**

## Errors
- (none)

## Warnings
- (none)

## Summary (redacted)
```json
{
  "per_env": {
    "dev": {
      "secret_ref_keys": [],
      "secrets_ref_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/secrets/dev.ref.yaml",
      "used_secret_refs": [],
      "values_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/values/dev.yaml",
      "values_keys": [
        "JWT_SECRET",
        "LLM_API_KEY",
        "PORT",
        "SERVICE_AUTH_SECRET",
        "SERVICE_NAME"
      ]
    },
    "prod": {
      "secret_ref_keys": [],
      "secrets_ref_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/secrets/prod.ref.yaml",
      "used_secret_refs": [],
      "values_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/values/prod.yaml",
      "values_keys": [
        "JWT_SECRET",
        "LLM_API_KEY",
        "PORT",
        "SERVICE_AUTH_SECRET",
        "SERVICE_NAME"
      ]
    },
    "staging": {
      "secret_ref_keys": [],
      "secrets_ref_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/secrets/staging.ref.yaml",
      "used_secret_refs": [],
      "values_file": "/Volumes/DataDisk/Project/Fun-ForumAI/env/values/staging.yaml",
      "values_keys": [
        "JWT_SECRET",
        "LLM_API_KEY",
        "PORT",
        "SERVICE_AUTH_SECRET",
        "SERVICE_NAME"
      ]
    }
  },
  "variables_non_secret": 93,
  "variables_secret": 0,
  "variables_total": 93
}
```

## Notes
- This report never includes secret values.
- If this is used in CI, treat any ERROR as a merge blocker.
