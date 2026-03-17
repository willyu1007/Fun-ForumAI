# Env Contract Validation

- Timestamp (UTC): `2026-03-09T03:38:49Z`
- Root: `/Users/phoenix/Desktop/project/Fun-ForumAI`
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
      "secret_ref_keys": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.ref.yaml",
      "used_secret_refs": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/dev.yaml",
      "values_keys": [
        "APP_ENV",
        "PORT",
        "SERVICE_NAME"
      ]
    },
    "prod": {
      "secret_ref_keys": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/prod.ref.yaml",
      "used_secret_refs": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/prod.yaml",
      "values_keys": [
        "APP_ENV",
        "PORT",
        "SERVICE_NAME"
      ]
    },
    "staging": {
      "secret_ref_keys": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/staging.ref.yaml",
      "used_secret_refs": [
        "dashscope_api_key",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "zai_api_key"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/staging.yaml",
      "values_keys": [
        "APP_ENV",
        "PORT",
        "SERVICE_NAME"
      ]
    }
  },
  "variables_non_secret": 87,
  "variables_secret": 9,
  "variables_total": 96
}
```

## Notes
- This report never includes secret values.
- If this is used in CI, treat any ERROR as a merge blocker.
