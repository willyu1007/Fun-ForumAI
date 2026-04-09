# Env Contract Validation

- Timestamp (UTC): `2026-04-09T23:29:27Z`
- Root: `/Users/phoenix/Desktop/project/Fun-ForumAI`
- Envs: `dev, dev.local, prod, prod-launch, staging, staging-launch`
- Status: **PASS**

## Errors
- (none)

## Warnings
- **UNUSED_SECRET_REFS**: Unused secret refs in env=dev: ['llm_api_default', 'llm_api_lowcost'] (/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.ref.yaml)
- **UNUSED_SECRET_REFS**: Unused secret refs in env=dev.local: ['llm_api_default', 'llm_api_lowcost'] (/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.local.ref.yaml)
- **UNUSED_SECRET_REFS**: Unused secret refs in env=prod-launch: ['llm_api_default', 'llm_api_lowcost'] (/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/prod-launch.ref.yaml)
- **UNUSED_SECRET_REFS**: Unused secret refs in env=staging-launch: ['llm_api_default', 'llm_api_lowcost'] (/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/staging-launch.ref.yaml)

## Summary (redacted)
```json
{
  "per_env": {
    "dev": {
      "secret_ref_keys": [
        "database_url",
        "jwt_secret",
        "llm_api_default",
        "llm_api_lowcost",
        "llm_api_pics",
        "service_auth_secret"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.ref.yaml",
      "used_secret_refs": [
        "database_url",
        "jwt_secret",
        "llm_api_pics",
        "service_auth_secret"
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
        "database_url",
        "jwt_secret",
        "llm_api_default",
        "llm_api_lowcost",
        "llm_api_pics",
        "service_auth_secret"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/dev.local.ref.yaml",
      "used_secret_refs": [
        "database_url",
        "jwt_secret",
        "llm_api_pics",
        "service_auth_secret"
      ],
      "values_file": null,
      "values_keys": []
    },
    "prod": {
      "secret_ref_keys": [
        "aliyun_sms_access_key_id",
        "aliyun_sms_access_key_secret",
        "ark_api_key",
        "ark_api_key_secondary",
        "auth_verification_secret",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_pics",
        "media_s3_access_key_id",
        "media_s3_secret_access_key",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "smtp_pass",
        "smtp_user",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/prod.ref.yaml",
      "used_secret_refs": [
        "aliyun_sms_access_key_id",
        "aliyun_sms_access_key_secret",
        "ark_api_key",
        "ark_api_key_secondary",
        "auth_verification_secret",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_pics",
        "media_s3_access_key_id",
        "media_s3_secret_access_key",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "smtp_pass",
        "smtp_user",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/prod.yaml",
      "values_keys": [
        "APP_ENV",
        "DB_PERSISTENCE",
        "MEDIA_S3_BUCKET",
        "MEDIA_STORAGE_BACKEND",
        "NODE_ENV",
        "PORT",
        "RUNTIME_LEADER_BACKEND",
        "RUNTIME_QUEUE_BACKEND",
        "SERVICE_NAME",
        "SSE_BROADCAST_BACKEND"
      ]
    },
    "prod-launch": {
      "secret_ref_keys": [
        "database_url",
        "jwt_secret",
        "llm_api_default",
        "llm_api_lowcost",
        "service_auth_secret"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/prod-launch.ref.yaml",
      "used_secret_refs": [
        "database_url",
        "jwt_secret",
        "service_auth_secret"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/prod-launch.yaml",
      "values_keys": [
        "APP_ENV",
        "FF_AFTERSHOW_AUDIENCE_SUMMARY_V1",
        "FF_AFTERSHOW_EVENT_PIPELINE_V1",
        "FF_AFTERSHOW_V1",
        "FF_AUDIENCE_AFTERSHOW_WEB_V1",
        "FF_AUDIENCE_ZONE_V1",
        "FF_GLOBAL_HIGHLIGHTS_V1",
        "FF_HOME_PROGRAMMING_V1",
        "FF_LIGHTWEIGHT_PERSONALIZATION_V1",
        "FF_MEMBERSHIPS_V1",
        "FF_MEMBERSHIP_STATUS_V1",
        "FF_POST_LAUNCH_TUNING_V1",
        "FF_PROGRAMMING_OPS_V1",
        "FF_ROLE_ASSIGNMENT_V1",
        "FF_STAGE_GOVERNANCE_V1",
        "FF_STAGE_ROLE_RUNTIME_V1",
        "FF_STAGE_SPEC_V1",
        "FF_STAGE_TIER_V1",
        "PORT",
        "SERVICE_NAME"
      ]
    },
    "staging": {
      "secret_ref_keys": [
        "aliyun_sms_access_key_id",
        "aliyun_sms_access_key_secret",
        "ark_api_key",
        "ark_api_key_secondary",
        "auth_verification_secret",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_pics",
        "llm_api_vision",
        "media_s3_access_key_id",
        "media_s3_secret_access_key",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "smtp_pass",
        "smtp_user",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/staging.ref.yaml",
      "used_secret_refs": [
        "aliyun_sms_access_key_id",
        "aliyun_sms_access_key_secret",
        "ark_api_key",
        "ark_api_key_secondary",
        "auth_verification_secret",
        "dashscope_api_key",
        "dashscope_api_key_secondary",
        "database_url",
        "deepseek_api_key",
        "jwt_secret",
        "llm_api_pics",
        "llm_api_vision",
        "media_s3_access_key_id",
        "media_s3_secret_access_key",
        "minimax_api_key",
        "minimax_api_key_secondary",
        "moonshot_api_key",
        "runtime_redis_url",
        "service_auth_secret",
        "smtp_pass",
        "smtp_user",
        "sse_redis_url",
        "tencent_hunyuan_api_key",
        "zai_api_key",
        "zai_api_key_secondary"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/staging.yaml",
      "values_keys": [
        "ALIYUN_SMS_SIGN_NAME",
        "ALIYUN_SMS_TEMPLATE_CODE",
        "APP_ENV",
        "AUTH_BOOTSTRAP_ADMIN_EMAILS",
        "AUTH_BOOTSTRAP_ADMIN_PHONES",
        "CORS_ORIGINS",
        "DB_PERSISTENCE",
        "EXPO_PUBLIC_FF_CHATROOM_STAGING_HOLD_V1",
        "FF_MEDIA_GENERATION_V1",
        "FF_MEDIA_LIFECYCLE_V1",
        "FF_MEDIA_OBSERVABILITY_V1",
        "FF_MEDIA_ROLLOUT_CONTROLLER_V1",
        "FF_MULTIMODAL_AGENT_MEDIA_V1",
        "IDENTITY_GATE_STAGING_MODE",
        "MEDIA_S3_BUCKET",
        "MEDIA_STORAGE_BACKEND",
        "NODE_ENV",
        "PORT",
        "RUNTIME_LEADER_BACKEND",
        "RUNTIME_QUEUE_BACKEND",
        "SERVICE_NAME",
        "SMTP_FROM_EMAIL",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_SECURE",
        "SSE_BROADCAST_BACKEND",
        "VITE_FF_CHATROOM_STAGING_HOLD_V1"
      ]
    },
    "staging-launch": {
      "secret_ref_keys": [
        "database_url",
        "jwt_secret",
        "llm_api_default",
        "llm_api_lowcost",
        "service_auth_secret"
      ],
      "secrets_ref_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/secrets/staging-launch.ref.yaml",
      "used_secret_refs": [
        "database_url",
        "jwt_secret",
        "service_auth_secret"
      ],
      "values_file": "/Users/phoenix/Desktop/project/Fun-ForumAI/env/values/staging-launch.yaml",
      "values_keys": [
        "APP_ENV",
        "FF_AFTERSHOW_AUDIENCE_SUMMARY_V1",
        "FF_AFTERSHOW_EVENT_PIPELINE_V1",
        "FF_AFTERSHOW_V1",
        "FF_AUDIENCE_AFTERSHOW_WEB_V1",
        "FF_AUDIENCE_ZONE_V1",
        "FF_GLOBAL_HIGHLIGHTS_V1",
        "FF_HOME_PROGRAMMING_V1",
        "FF_LIGHTWEIGHT_PERSONALIZATION_V1",
        "FF_MEMBERSHIPS_V1",
        "FF_MEMBERSHIP_STATUS_V1",
        "FF_POST_LAUNCH_TUNING_V1",
        "FF_PROGRAMMING_OPS_V1",
        "FF_ROLE_ASSIGNMENT_V1",
        "FF_STAGE_GOVERNANCE_V1",
        "FF_STAGE_ROLE_RUNTIME_V1",
        "FF_STAGE_SPEC_V1",
        "FF_STAGE_TIER_V1",
        "PORT",
        "SERVICE_NAME"
      ]
    }
  },
  "variables_non_secret": 144,
  "variables_secret": 25,
  "variables_total": 169
}
```

## Notes
- This report never includes secret values.
- If this is used in CI, treat any ERROR as a merge blocker.
