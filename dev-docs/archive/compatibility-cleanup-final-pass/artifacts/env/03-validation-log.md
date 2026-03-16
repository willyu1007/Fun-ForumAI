# Env Contract Validation

- Timestamp (UTC): `2026-03-16T06:58:21Z`
- Root: `/Users/phoenix/Desktop/project/Fun-ForumAI`
- Envs: `dev, dev.local, prod, staging`
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
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.ref.yaml",
      "used_secret_refs": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/dev.yaml",
      "values_keys": [
        "APP_ENV",
        "PORT",
        "SERVICE_NAME"
      ]
    },
    "dev.local": {
      "secret_ref_keys": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.local.ref.yaml",
      "used_secret_refs": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "values_file": null,
      "values_keys": []
    },
    "prod": {
      "secret_ref_keys": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/prod.ref.yaml",
      "used_secret_refs": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
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
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/staging.ref.yaml",
      "used_secret_refs": [
        "ark_api_key",
        "ark_api_key_secondary",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "deepseek_api_key_secondary",
        "jwt_secret",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "moonshot_api_key_secondary",
        "runtime_redis_url",
        "service_auth_secret",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "tencent_hunyuan_api_key_secondary",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/staging.yaml",
      "values_keys": [
        "APP_ENV",
        "PORT",
        "SERVICE_NAME"
      ]
    }
  },
  "variables_non_secret": 91,
  "variables_secret": 19,
  "variables_total": 110
}
```

## Notes
- This report never includes secret values.
- If this is used in CI, treat any ERROR as a merge blocker.
