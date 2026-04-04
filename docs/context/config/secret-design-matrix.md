# Secret Design Matrix

This document defines how application secrets are grouped, named, and expected to differ across `dev`, `staging`, and `prod`.

## Conclusion

- Secret design is split into 3 layers:
  - `core-startup`
  - `feature-gated-capabilities`
  - `provider-and-routing`
- `dev` MAY use function-oriented Bitwarden key names when that makes feature testing simpler.
- `staging` and `prod` SHOULD use provider-oriented or infrastructure-oriented Bitwarden key names so routing, failover, and ownership stay explicit.
- Application-facing env keys and `secret_ref` names in `env/contract.yaml` remain the stable contract. Environment-specific Bitwarden naming is translated by `env/secrets/*.ref.yaml`.

## Layer Model

| Layer | Purpose | Typical examples | Primary consumers |
| --- | --- | --- | --- |
| `core-startup` | Minimum secrets required to boot the service and authenticate safely. | `database_url`, `jwt_secret`, `service_auth_secret` | `src/backend/lib/config.ts` |
| `feature-gated-capabilities` | Secrets that are only required when a feature is enabled. | `auth_verification_secret`, `smtp_user`, `smtp_pass`, `llm_api_pics`, `media_s3_access_key_id`, `runtime_redis_url`, `sse_redis_url` | `src/backend/lib/config.ts` |
| `provider-and-routing` | Secrets used by the LLM gateway and routing/failover policy. In `dev` they may be capability-oriented; in `staging` and `prod` they map to concrete provider credentials and only expose the credential pools actually admitted by runtime. | `dashscope_api_key`, `dashscope_api_key_secondary`, `llm_api_vision`, `zai_api_key`, `zai_api_key_secondary`, `ark_api_key` | `.ai/llm-config/registry/credential_pools.yaml`, `.ai/llm-config/registry/config_keys.yaml` |

## Environment Rules

### `dev`

- Goal: local startup and feature testing.
- Bitwarden project: `mr-common-dev`.
- Naming mode: function-oriented naming is allowed.
- Current Bitwarden mapping is defined in `env/secrets/dev.ref.yaml`.
- `dev` SHOULD include only the fixed local feature-test baseline. Secrets outside that baseline should not remain declared in `dev`, to avoid semantic drift.

Current `dev` matrix:

| Layer | `secret_ref` | Current Bitwarden key |
| --- | --- | --- |
| `core-startup` | `database_url` | `talkshow-dev/database_url` |
| `core-startup` | `jwt_secret` | `talkshow-dev/jwt_secret` |
| `core-startup` | `service_auth_secret` | `talkshow-dev/service_auth_secret` |
| `provider-and-routing` | `llm_api_default` | `talkshow-dev/llm_api_default` |
| `provider-and-routing` | `llm_api_lowcost` | `talkshow-dev/llm_api_lowcost` |
| `feature-gated-capabilities` | `llm_api_pics` | `talkshow-dev/llm_api_pics` |

Notes:

- `dev` intentionally does not require SMTP, SMS, Redis, S3, or provider secondary keys.
- `AUTH_VERIFICATION_SECRET` is not part of the `dev` secret set because runtime falls back to `JWT_SECRET` in `src/backend/lib/config.ts`.
- Function-oriented keys such as `talkshow-dev/llm_api_default`, `talkshow-dev/llm_api_lowcost`, and `talkshow-dev/llm_api_pics` are part of the fixed `dev` baseline because local development is expected to cover default text generation, low-cost generation, and image-generation feature paths.

### `staging`

- Goal: full-function pre-production environment that can rehearse `prod` behavior end-to-end.
- Bitwarden project: `mr-common-staging`.
- Naming mode: provider-oriented and infrastructure-oriented.
- Current Bitwarden mapping is defined in `env/secrets/staging.ref.yaml`.
- `staging` SHOULD include:
  - all `core-startup` secrets
  - the full `feature-gated-capabilities` layer required to exercise production features
  - the provider/routing secrets required by the currently admitted production-like topology

Current `staging` checklist:

| Layer | `secret_ref` set | Current Bitwarden key pattern |
| --- | --- | --- |
| `core-startup` | `database_url`, `jwt_secret`, `service_auth_secret` | `talkshow-stag/<secret_ref>` |
| `feature-gated-capabilities` | `auth_verification_secret`, `smtp_user`, `smtp_pass`, `aliyun_sms_access_key_id`, `aliyun_sms_access_key_secret`, `llm_api_pics`, `media_s3_access_key_id`, `media_s3_secret_access_key`, `runtime_redis_url`, `sse_redis_url` | infrastructure-oriented and provider-oriented Bitwarden keys such as `talkshow-stag/smtp_user`, `llm_api_pics_generation`, and `talkshow-stag/redis_url_runtime` |
| `provider-and-routing` | `dashscope_api_key`, `dashscope_api_key_secondary`, `llm_api_vision`, `zai_api_key`, `zai_api_key_secondary`, `deepseek_api_key`, `moonshot_api_key`, `minimax_api_key`, `minimax_api_key_secondary`, `tencent_hunyuan_api_key`, `ark_api_key`, `ark_api_key_secondary` | provider-oriented staging Bitwarden keys such as `llm_api_qwen_1`, `llm_api_qwen_2`, `llm_api_glm_1`, `llm_api_glm_2`, `llm_api_deepseek_1`, `llm_api_kimi_1`, `llm_api_minimax_1`, `llm_api_minimax_2`, `llm_api_tecent_1`, `llm_api_ark_1`, and `llm_api_ark_2` |

Notes:

- `staging` keeps `llm_api_pics` because posting-time image generation is an expected staging capability. Actual generation is explicitly enabled in `env/values/staging.yaml` with `FF_MEDIA_GENERATION_V1=true`.
- `staging` now has a dedicated `llm_api_vision` secret for image understanding and semantic snapshot ingestion. The `vision_summary` route prefers `llm_api_vision` first and falls back to the primary DashScope credential if the dedicated vision credential is absent or unusable.
- `staging` consumes the current operator-owned provider keys `llm_api_qwen_1/2`, `llm_api_glm_1/2`, `llm_api_deepseek_1`, `llm_api_kimi_1`, `llm_api_minimax_1/2`, `llm_api_tecent_1`, and `llm_api_ark_1/2`.
- Only providers that actually have a second credential in Bitwarden keep a `*-secondary` credential pool in runtime. `deepseek`, `moonshot`, and `tencent` currently use a single staging credential and rely on cross-provider fallback instead of duplicate-key retry.
- `llm_api_default` and `llm_api_openai` may still exist in Bitwarden for legacy/manual operator use, but they are not part of the normal staging cloud routing surface unless explicitly admitted by the runtime registry.
- `staging` now enables the prod-like non-secret baseline in `env/values/staging.yaml`: `NODE_ENV=production`, `DB_PERSISTENCE=true`, Redis-backed runtime/SSE, `MEDIA_STORAGE_BACKEND=s3`, and the media generation/observability/lifecycle flags required for the image pipeline.
- Non-dev environments no longer silently degrade when Redis or S3 is requested. In `src/backend/container/infra.ts` and `src/backend/container/llm.ts`, missing staging/prod Redis or S3 requirements now fail fast instead of falling back to local or in-memory behavior.

### `prod`

- Goal: production delivery with operationally precise routing and rotation ownership.
- Current Bitwarden refs are defined in `env/secrets/prod.ref.yaml`.
- Current implementation still resolves through Bitwarden project `mr-common-staging`, but with `talkshow-prod/...` keys.
- `prod` MUST preserve provider-oriented naming and MUST keep the admitted credential surface explicit. Secondary credentials should exist only where the operator actually maintains a distinct second key.
- `prod` now carries the same cloud baseline in `env/values/prod.yaml` for `NODE_ENV=production`, `DB_PERSISTENCE=true`, Redis-backed runtime/SSE, and `MEDIA_STORAGE_BACKEND=s3`.
- `RUNTIME_ENABLED` is intentionally absent from shared staging/prod env values. API keeps `RUNTIME_ENABLED=false` in `compose.yaml`, and worker raises `RUNTIME_ENABLED=true` only through the workload contract.

Current `prod` checklist:

| Layer | `secret_ref` set | Current Bitwarden key pattern |
| --- | --- | --- |
| `core-startup` | `database_url`, `jwt_secret`, `service_auth_secret` | `talkshow-prod/<secret_ref>` |
| `feature-gated-capabilities` | `auth_verification_secret`, `smtp_user`, `smtp_pass`, `aliyun_sms_access_key_id`, `aliyun_sms_access_key_secret`, `llm_api_pics`, `media_s3_access_key_id`, `media_s3_secret_access_key`, `runtime_redis_url`, `sse_redis_url` | provider-oriented Bitwarden keys such as `talkshow-prod/media_generation_api_key` |
| `provider-and-routing` | `dashscope_api_key`, `dashscope_api_key_secondary`, `zai_api_key`, `zai_api_key_secondary`, `deepseek_api_key`, `moonshot_api_key`, `minimax_api_key`, `minimax_api_key_secondary`, `tencent_hunyuan_api_key`, `ark_api_key`, `ark_api_key_secondary` | provider-oriented Bitwarden keys such as `talkshow-prod/dashscope_api_key`, `talkshow-prod/zai_api_key_secondary`, and `talkshow-prod/minimax_api_key_secondary` |

## Contract and Runtime Mapping

- The env contract is authoritative for logical secret names: `env/contract.yaml`.
- Bitwarden lookup is environment-specific and lives in:
  - `env/secrets/dev.ref.yaml`
  - `env/secrets/staging.ref.yaml`
  - `env/secrets/prod.ref.yaml`
- Backend runtime consumption of startup, delivery, media, and Redis secrets is centralized in `src/backend/lib/config.ts`.
- LLM provider and failover credentials are consumed through:
  - `.ai/llm-config/registry/credential_pools.yaml`
  - `.ai/llm-config/registry/config_keys.yaml`

## Review Checklist

- Add a new secret to `core-startup` only when the app cannot boot safely without it.
- Add a new secret to `feature-gated-capabilities` when a feature can be disabled or has a fallback.
- Add a new secret to `provider-and-routing` only when it directly participates in routing, failover, or provider admission.
- Keep `dev` minimal. Do not copy the full staging/provider topology into local development by default.
- Keep `staging` and `prod` provider names explicit enough that on-call rotation and failover decisions remain obvious, including clarity about which providers actually have a second credential and which rely on cross-provider fallback.
