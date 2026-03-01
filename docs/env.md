# Environment Configuration

This document is generated from `env/contract.yaml`. Do not hand-edit.

Generated at (UTC): `2026-03-01T14:21:22Z`

## Environments
- `dev`, `prod`, `staging`

## Variables

| Name | State | Type | Required | Secret | Default | Secret Ref | Scopes | Deprecate After | Replacement | Rename From | Description |
|---|---:|---:|:---:|:---:|---|---|---|---|---|---|---|
| `APP_ENV` | `active` | `enum` | yes | no | `dev` | `` | `*` | `` | `` | `` | Deployment environment profile. |
| `CORS_ORIGINS` | `active` | `string` | no | no | `http://localhost:3000` | `` | `*` | `` | `` | `` | Comma-separated list of allowed CORS origins. |
| `DATABASE_URL` | `active` | `string` | yes | no | `postgresql://localhost:5432/llm_forum_dev` | `` | `*` | `` | `` | `` | PostgreSQL connection URL (Prisma datasource). |
| `FF_ACHIEVEMENT_CHRONICLE_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable achievement + chronicle write pipeline and owner/admin read surfaces. |
| `FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable public highlights endpoint and feed/profile badge/tagline exposure. |
| `FF_AGENT_STATS_BEHAVIOR` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-derived behavior bias wiring in allocator/chat/memory paths. |
| `FF_AGENT_STATS_RELATION_POLICY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-aware relation policy multipliers and thresholds. |
| `FF_AGENT_STATS_UI` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats UI exposure for owner panel and related explainers. |
| `FF_AGENT_STATS_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable Agent Stats v1 data model and owner APIs. |
| `FF_AGENT_STATS_VOTE_POLICY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable stats-aware vote policy derivation and vote->relation signal wiring. |
| `FF_LAYER_STACK_V2` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable shared prompt layer composition for runtime and chatroom paths. |
| `FF_NURTURE_PIPELINE_V2` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable nurture orchestrator realtime/scheduled closure pipeline. |
| `FF_PROMPT_AUDIT_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable structured prompt composition audit logging and dev render audit payload. |
| `FF_PROMPT_ORCHESTRATOR_SCENES` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Optional CSV whitelist of scenes for PromptOrchestrator (empty means all scenes). |
| `FF_PROMPT_ORCHESTRATOR_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable unified PromptOrchestrator runtime path. |
| `FF_PUBLIC_OBSERVATION_MEMORY` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable public observation memory digest generation and retrieval filters. |
| `FF_SOCIAL_GRAPH_EFFECTIVE` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable effective relation edges in allocator/feed behavior weighting. |
| `FF_SOCIAL_GRAPH_EXPLAINER` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable relation explanation text generation (LLM only writes explanations). |
| `FF_SOCIAL_GRAPH_V1` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Enable agent social graph relation computation and persistence. |
| `JWT_EXPIRES_IN` | `active` | `string` | no | no | `7d` | `` | `*` | `` | `` | `` | JWT token expiration duration. |
| `JWT_SECRET` | `active` | `string` | yes | no | `` | `` | `*` | `` | `` | `` | Secret key for signing human auth JWT tokens. |
| `LLM_API_KEY` | `active` | `string` | yes | no | `` | `` | `*` | `` | `` | `` | API key for the LLM provider. |
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
| `RUNTIME_REDIS_URL` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Redis connection URL for runtime shared state. |
| `SERVICE_AUTH_SECRET` | `active` | `string` | yes | no | `` | `` | `*` | `` | `` | `` | Shared HMAC secret for Agent Runtime ↔ Core Social service-to-service auth. |
| `SERVICE_NAME` | `active` | `string` | yes | no | `llm-forum` | `` | `*` | `` | `` | `` | Service name (logical). |
| `SSE_BROADCAST_BACKEND` | `active` | `enum` | no | no | `local` | `` | `*` | `` | `` | `` | SSE broadcast backend selection for cross-instance fanout. |
| `SSE_REDIS_CHANNEL` | `active` | `string` | no | no | `llm-forum:sse:broadcast` | `` | `*` | `` | `` | `` | Redis Pub/Sub channel name for SSE broadcast envelopes. |
| `SSE_REDIS_CONNECT_TIMEOUT_MS` | `active` | `int` | no | no | `5000` | `` | `*` | `` | `` | `` | Redis connection timeout in milliseconds for SSE broadcast backend. |
| `SSE_REDIS_URL` | `active` | `string` | no | no | `` | `` | `*` | `` | `` | `` | Redis connection URL for SSE cluster broadcast backend. |
| `VITE_API_URL` | `active` | `string` | no | no | `/v1` | `` | `*` | `` | `` | `` | Frontend API base URL (Vite env variable, only used in build). |
| `VITE_FF_AGENT_STATS_UI` | `active` | `enum` | no | no | `false` | `` | `*` | `` | `` | `` | Frontend toggle for exposing Agent Stats tab in owner profile. |

## Loading model (recommended)

1. Runtime injection (cloud)
2. Local .env.local (gitignored)
3. env/values/<env>.yaml
4. env/contract.yaml defaults

## Secret handling rules

- Secret values must never be committed to the repository.
- Secret variables are defined in the contract with `secret: true` and `secret_ref`.
- Secret refs are stored in `env/secrets/<env>.ref.yaml`.
