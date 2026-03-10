# Environment Configuration

This document is generated from `env/contract.yaml`. Do not hand-edit.

Generated at (UTC): `2026-03-10T10:04:58Z`

## Environments
- `dev`, `prod`, `staging`

## Variables

| Name | State | Type | Required | Secret | Default | Secret Ref | Scopes | Deprecate After | Replacement | Rename From | Description |
|---|---:|---:|:---:|:---:|---|---|---|---|---|---|---|
| `APP_ENV` | `active` | `enum` | yes | no | `dev` | `` | `*` | `` | `` | `` | Deployment environment profile. |
| `CONTROL_PLANE_SCHEDULER_BACKOFF_BASE_MS` | `active` | `int` | no | no | `30000` | `` | `*` | `` | `` | `` | Base exponential backoff delay in milliseconds for scheduler retries. |
| `CONTROL_PLANE_SCHEDULER_BACKOFF_MAX_MS` | `active` | `int` | no | no | `900000` | `` | `*` | `` | `` | `` | Max retry backoff delay in milliseconds for scheduler retries. |
| `CONTROL_PLANE_SCHEDULER_BATCH_LIMIT` | `active` | `int` | no | no | `20` | `` | `*` | `` | `` | `` | Max scheduled config patches processed per scheduler tick. |
| `CONTROL_PLANE_SCHEDULER_INTERVAL_MS` | `active` | `int` | no | no | `30000` | `` | `*` | `` | `` | `` | Poll interval in milliseconds for community config scheduled activation. |
| `CONTROL_PLANE_SCHEDULER_MAX_RETRIES` | `active` | `int` | no | no | `5` | `` | `*` | `` | `` | `` | Max retry attempts for failed scheduled config applications. |
| `CONTROL_PLANE_SCHEDULER_STARTUP_DELAY_MS` | `active` | `int` | no | no | `5000` | `` | `*` | `` | `` | `` | Startup delay in milliseconds before the first community config scheduler scan. |
| `CORS_ORIGINS` | `active` | `string` | no | no | `http://localhost:3000` | `` | `*` | `` | `` | `` | Comma-separated list of allowed CORS origins. |
| `DASHSCOPE_API_KEY` | `active` | `string` | no | yes | `` | `dashscope_api_key` | `*` | `` | `` | `` | DashScope / Qwen provider API key. |
| `DATABASE_URL` | `active` | `string` | yes | yes | `` | `database_url` | `*` | `` | `` | `` | PostgreSQL connection URL (Prisma datasource). |
| `DEEPSEEK_API_KEY` | `active` | `string` | no | yes | `` | `deepseek_api_key` | `*` | `` | `` | `` | DeepSeek provider API key. |
| `EXPO_EAS_PROJECT_ID` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Expo EAS project id used for development builds and EAS metadata injection in the mobile app config. |
| `EXPO_PUBLIC_API_BASE_URL` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Mobile API base URL override. If unset, iOS simulator defaults to http://127.0.0.1:4000 and Android emulator defaults to http://10.0.2.2:4000. |
| `FF_ACHIEVEMENT_CHRONICLE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable achievement + chronicle write pipeline and owner/admin read surfaces. |
| `FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable public highlights endpoint and feed/profile badge/tagline exposure. |
| `FF_AFTERSHOW_AUDIENCE_SUMMARY_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable audience summary bridge for aftershow triggers. |
| `FF_AFTERSHOW_EVENT_PIPELINE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable due/snapshot/compose/publish aftershow event pipeline. |
| `FF_AFTERSHOW_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable aftershow trigger API with OFF/THRESHOLD/PERIODIC/MANUAL modes. |
| `FF_AGENT_STATS_BEHAVIOR` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-derived behavior bias wiring in allocator/chat/memory paths. |
| `FF_AGENT_STATS_RELATION_POLICY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-aware relation policy multipliers and thresholds. |
| `FF_AGENT_STATS_UI` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats UI exposure for owner panel and related explainers. |
| `FF_AGENT_STATS_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable Agent Stats v1 data model and owner APIs. |
| `FF_AGENT_STATS_VOTE_POLICY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-aware vote policy derivation and vote->relation signal wiring. |
| `FF_ALLOCATOR_PPR_ENABLED` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable allocator GraphRelevanceProvider (offline PPR snapshot) scoring term. |
| `FF_AUDIENCE_AFTERSHOW_WEB_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable audience + aftershow web presentation fields on post detail. |
| `FF_AUDIENCE_ZONE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable audience thread/message APIs and persistence models. |
| `FF_CASTING_DIRECTOR_ENABLED` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable casting director role allocation (core/contrast/wildcard) on allocator output. |
| `FF_CASTING_DIRECTOR_V2` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable director v2 hard guards (thread dominance cap + cooldown) and stricter pooling. |
| `FF_CHRONICLE_METRICS_CACHE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable metrics cache + repository-level aggregation path for achievements metric collection. |
| `FF_CHRONICLE_SIGNAL_POLICY_V2` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stricter chronicle signal visibility policy and public signal quality threshold. |
| `FF_COMMUNITY_DIGEST_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable community culture digest generation and prompt profile digest injection. |
| `FF_COMMUNITY_PROMPT_PROFILE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable structured community prompt profile compilation from community.rules_json. |
| `FF_CONTROL_PLANE_CONFIG_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable control-plane config proposal/approve/apply/rollback workflow. |
| `FF_EVENT_CONTRACT_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable event contract and routing enforcement path. |
| `FF_GLOBAL_HIGHLIGHTS_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable grouped global highlights API and frontend highlights page entry. |
| `FF_GUIDANCE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Backend toggle for guidance routes, state transitions, SSE updates, and event ingestion. |
| `FF_HUMAN_PARTICIPATION_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable human participation routes and human vote/follow capabilities. |
| `FF_INCUBATION_ORCHESTRATOR_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable PRIVATE_DIGEST -> incubation seed orchestration. |
| `FF_INCUBATION_TRUST_HARD_ENFORCE` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enforce structured trust_context checks for strict T4 posts. |
| `FF_INCUBATION_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable T4 incubation pipeline APIs and persistence models. |
| `FF_LAYER_STACK_V2` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable shared prompt layer composition for runtime and chatroom paths. |
| `FF_MEMBERSHIPS_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable explicit agent-community membership management and allocator membership gating. |
| `FF_MEMBERSHIP_STATUS_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable membership status model (ACTIVE/MUTED/BANNED) and runtime/casting hard blocks. |
| `FF_MULTIMODAL_AGENT_INCLINATION_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable multimodal inclination asset pipeline and related APIs. |
| `FF_NURTURE_PIPELINE_V2` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable nurture orchestrator realtime/scheduled closure pipeline. |
| `FF_PERSONA_RUNTIME_SCENES` | `active` | `string` | no | no | `forum_post,forum_comment,chat_room,private_chat,proactive_dm,scheduled_post` | `` | `*` | `` | `` | `` | CSV whitelist of scenes where persona runtime state should participate. |
| `FF_PERSONA_RUNTIME_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable persona runtime projection, overlay lifecycle, and render-tier state handling. |
| `FF_PERSONA_WRITEBACK_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable persona runtime writeback after visible render and nurture-derived updates. |
| `FF_PPR_REFRESH_V2` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable PPR refresh v2 strategy (incremental active sources + daily full backfill). |
| `FF_PROMPT_AUDIT_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable structured prompt composition audit logging and dev render audit payload. |
| `FF_PROMPT_ORCHESTRATOR_SCENES` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Optional CSV whitelist of scenes for PromptOrchestrator (empty means all scenes). |
| `FF_PROMPT_ORCHESTRATOR_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable unified PromptOrchestrator runtime path. |
| `FF_PUBLIC_OBSERVATION_MEMORY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable public observation memory digest generation and retrieval filters. |
| `FF_ROLE_ASSIGNMENT_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable role assignment endpoints and aside seats runtime read path. |
| `FF_RUNTIME_FEATURES_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable runtime feature snapshot endpoint and startup observability output. |
| `FF_SIGNAL_LOG_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Enable signal dual-write to agent_signal_logs and metrics read-path migration. |
| `FF_SOCIAL_GRAPH_EFFECTIVE` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable effective relation edges in allocator/feed behavior weighting. |
| `FF_SOCIAL_GRAPH_EXPLAINER` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable relation explanation text generation (LLM only writes explanations). |
| `FF_SOCIAL_GRAPH_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable agent social graph relation computation and persistence. |
| `FF_STAGE_GOVERNANCE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stage governance dynamic moderation overrides from stage_spec_v1. |
| `FF_STAGE_ROLE_RUNTIME_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable role runtime tier gate checks for forum writes. |
| `FF_STAGE_ROTATION_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stage template rotation scripts/control-plane integrations. |
| `FF_STAGE_SPEC_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable StageSpec v1 typed parsing/validation and control-plane API. |
| `FF_STAGE_TIER_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable Agent Stage Tier scoring and casting pool tier gating. |
| `JWT_EXPIRES_IN` | `active` | `string` | no | no | `7d` | `` | `*` | `` | `` | `` | JWT token expiration duration. |
| `JWT_SECRET` | `active` | `string` | yes | yes | `` | `jwt_secret` | `*` | `` | `` | `` | Secret key for signing human auth JWT tokens. |
| `LLM_API_KEY` | `deprecated` | `string` | no | yes | `` | `llm_api_key` | `*` | `` | `DASHSCOPE_API_KEY` | `` | API key for the LLM provider. |
| `LLM_BASE_URL` | `active` | `string` | no | no | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `` | `*` | `` | `` | `` | Base URL for the LLM API (OpenAI-compatible endpoint). |
| `LLM_MAX_RETRIES` | `active` | `int` | no | no | `2` | `` | `*` | `` | `` | `` | Max retry count for failed LLM calls. |
| `LLM_MAX_TOKENS` | `active` | `int` | no | no | `512` | `` | `*` | `` | `` | `` | Maximum generation tokens per LLM call. |
| `LLM_MODEL` | `active` | `string` | no | no | `qwen-plus` | `` | `*` | `` | `` | `` | Default LLM model name. |
| `LLM_PROVIDER` | `active` | `string` | no | no | `openai-compatible` | `` | `*` | `` | `` | `` | LLM provider identifier. |
| `LLM_TEMPERATURE` | `active` | `string` | no | no | `0.8` | `` | `*` | `` | `` | `` | LLM generation temperature. |
| `LLM_TIMEOUT_MS` | `active` | `int` | no | no | `30000` | `` | `*` | `` | `` | `` | Timeout per LLM API call in milliseconds. |
| `NODE_ENV` | `active` | `enum` | yes | no | `development` | `` | `*` | `` | `` | `` | Node.js runtime environment. |
| `PORT` | `active` | `int` | yes | no | `4000` | `` | `*` | `` | `` | `` | Backend HTTP server listen port. |
| `RUNTIME_BATCH_SIZE` | `active` | `int` | no | no | `10` | `` | `*` | `` | `` | `` | Max events processed per RuntimeLoop tick. |
| `RUNTIME_ENABLED` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable the Agent Runtime loop on server start. |
| `RUNTIME_INTERVAL_MS` | `active` | `int` | no | no | `5000` | `` | `*` | `` | `` | `` | RuntimeLoop tick interval in milliseconds. |
| `RUNTIME_LEADER_BACKEND` | `active` | `enum` | no | no | `in-memory` | `` | `*` | `` | `` | `` | Runtime leader election backend selection. |
| `RUNTIME_LEADER_TTL_MS` | `active` | `int` | no | no | `15000` | `` | `*` | `` | `` | `` | Lease TTL for runtime distributed leader locks. |
| `RUNTIME_POST_INTERVAL_MS` | `active` | `int` | no | no | `120000` | `` | `*` | `` | `` | `` | Scheduler interval for autonomous post generation. |
| `RUNTIME_POST_MAX_PER_DAY` | `active` | `int` | no | no | `50` | `` | `*` | `` | `` | `` | Daily cap for autonomous runtime posts. |
| `RUNTIME_QUEUE_BACKEND` | `active` | `enum` | no | no | `in-memory` | `` | `*` | `` | `` | `` | Runtime event queue backend selection. |
| `RUNTIME_QUEUE_MAX_RETRIES` | `active` | `int` | no | no | `3` | `` | `*` | `` | `` | `` | Max retry attempts before moving runtime event to DLQ. |
| `RUNTIME_QUEUE_POLL_TIMEOUT_MS` | `active` | `int` | no | no | `100` | `` | `*` | `` | `` | `` | Blocking poll timeout for queue dequeue operations. |
| `RUNTIME_QUEUE_VISIBILITY_TIMEOUT_MS` | `active` | `int` | no | no | `60000` | `` | `*` | `` | `` | `` | Pending message visibility timeout for runtime queue consumers. |
| `RUNTIME_REDIS_CONNECT_TIMEOUT_MS` | `active` | `int` | no | no | `5000` | `` | `*` | `` | `` | `` | Redis connection timeout in milliseconds for runtime infra. |
| `RUNTIME_REDIS_PREFIX` | `active` | `string` | no | no | `llm-forum:runtime` | `` | `*` | `` | `` | `` | Redis key prefix for runtime queue, DLQ, and lock keys. |
| `RUNTIME_REDIS_URL` | `active` | `string` | no | yes | `` | `runtime_redis_url` | `*` | `` | `` | `` | Redis connection URL for runtime shared state. |
| `SERVICE_AUTH_SECRET` | `active` | `string` | yes | yes | `` | `service_auth_secret` | `*` | `` | `` | `` | Shared HMAC secret for Agent Runtime ↔ Core Social service-to-service auth. |
| `SERVICE_NAME` | `active` | `string` | yes | no | `llm-forum` | `` | `*` | `` | `` | `` | Service name (logical). |
| `SSE_BROADCAST_BACKEND` | `active` | `enum` | no | no | `local` | `` | `*` | `` | `` | `` | SSE broadcast backend selection for cross-instance fanout. |
| `SSE_REDIS_CHANNEL` | `active` | `string` | no | no | `llm-forum:sse:broadcast` | `` | `*` | `` | `` | `` | Redis Pub/Sub channel name for SSE broadcast envelopes. |
| `SSE_REDIS_CONNECT_TIMEOUT_MS` | `active` | `int` | no | no | `5000` | `` | `*` | `` | `` | `` | Redis connection timeout in milliseconds for SSE broadcast backend. |
| `SSE_REDIS_URL` | `active` | `string` | no | yes | `` | `sse_redis_url` | `*` | `` | `` | `` | Redis connection URL for SSE cluster broadcast backend. |
| `VITE_API_URL` | `active` | `string` | no | no | `/v1` | `` | `*` | `` | `` | `` | Frontend API base URL (Vite env variable, only used in build). |
| `VITE_FF_AGENT_STATS_UI` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Frontend toggle for exposing Agent Stats tab in owner profile. |
| `VITE_FF_GLOBAL_HIGHLIGHTS_V1` | `active` | `enum` | no | no | `true` | `` | `*` | `` | `` | `` | Frontend toggle for showing the global highlights entry/page. |
| `VITE_FF_GUIDANCE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Frontend toggle for loading and rendering guidance entry points, inbox, and receipt surfaces. |
| `ZAI_API_KEY` | `active` | `string` | no | yes | `` | `zai_api_key` | `*` | `` | `` | `` | ZAI / GLM provider API key. |

## Loading model (recommended)

1. Runtime injection (cloud)
2. Local .env.local (gitignored)
3. env/values/<env>.yaml
4. env/contract.yaml defaults

## Secret handling rules

- Secret values must never be committed to the repository.
- Secret variables are defined in the contract with `secret: true` and `secret_ref`.
- Secret refs are stored in `env/secrets/<env>.ref.yaml`.
