# Local Environment Compile Report

- Timestamp (UTC): `2026-03-07T14:03:09Z`
- Env: `dev`
- Runtime target: `local`
- Workload: `api`
- Status: **PASS**
- Env file: `/Volumes/DataDisk/Project/Fun-ForumAI/.env.local`
- Effective context: `/Volumes/DataDisk/Project/Fun-ForumAI/docs/context/env/effective-dev.json`

## Warnings
- Preflight warning: No credential signals detected

## Key summary (redacted)
```json
{
  "APP_ENV": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "CONTROL_PLANE_SCHEDULER_BACKOFF_BASE_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CONTROL_PLANE_SCHEDULER_BACKOFF_MAX_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CONTROL_PLANE_SCHEDULER_BATCH_LIMIT": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CONTROL_PLANE_SCHEDULER_INTERVAL_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CONTROL_PLANE_SCHEDULER_MAX_RETRIES": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CONTROL_PLANE_SCHEDULER_STARTUP_DELAY_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "CORS_ORIGINS": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "DATABASE_URL": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "EXPO_EAS_PROJECT_ID": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "FF_ACHIEVEMENT_CHRONICLE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AFTERSHOW_AUDIENCE_SUMMARY_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AFTERSHOW_EVENT_PIPELINE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AFTERSHOW_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AGENT_STATS_BEHAVIOR": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AGENT_STATS_RELATION_POLICY": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AGENT_STATS_UI": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AGENT_STATS_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AGENT_STATS_VOTE_POLICY": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_ALLOCATOR_PPR_ENABLED": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AUDIENCE_AFTERSHOW_WEB_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_AUDIENCE_ZONE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_CASTING_DIRECTOR_ENABLED": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_CASTING_DIRECTOR_V2": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_CHRONICLE_METRICS_CACHE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_CHRONICLE_SIGNAL_POLICY_V2": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_COMMUNITY_DIGEST_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_COMMUNITY_PROMPT_PROFILE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_CONTROL_PLANE_CONFIG_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_EVENT_CONTRACT_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_GLOBAL_HIGHLIGHTS_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_HUMAN_PARTICIPATION_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_INCUBATION_ORCHESTRATOR_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_INCUBATION_TRUST_HARD_ENFORCE": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_INCUBATION_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_LAYER_STACK_V2": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_MEMBERSHIPS_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_MEMBERSHIP_STATUS_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_MULTIMODAL_AGENT_INCLINATION_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_NURTURE_PIPELINE_V2": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_PPR_REFRESH_V2": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_PROMPT_AUDIT_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_PROMPT_ORCHESTRATOR_SCENES": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "FF_PROMPT_ORCHESTRATOR_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_PUBLIC_OBSERVATION_MEMORY": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_ROLE_ASSIGNMENT_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_RUNTIME_FEATURES_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_SIGNAL_LOG_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_SOCIAL_GRAPH_EFFECTIVE": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_SOCIAL_GRAPH_EXPLAINER": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_SOCIAL_GRAPH_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_STAGE_GOVERNANCE_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_STAGE_ROLE_RUNTIME_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_STAGE_ROTATION_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_STAGE_SPEC_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "FF_STAGE_TIER_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "JWT_EXPIRES_IN": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "JWT_SECRET": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_API_KEY": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_BASE_URL": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_MAX_RETRIES": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "LLM_MAX_TOKENS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "LLM_MODEL": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_PROVIDER": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_TEMPERATURE": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "LLM_TIMEOUT_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "NODE_ENV": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "PORT": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_BATCH_SIZE": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_ENABLED": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "RUNTIME_INTERVAL_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_LEADER_BACKEND": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "RUNTIME_LEADER_TTL_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_POST_INTERVAL_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_POST_MAX_PER_DAY": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_QUEUE_BACKEND": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "RUNTIME_QUEUE_MAX_RETRIES": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_QUEUE_POLL_TIMEOUT_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_QUEUE_VISIBILITY_TIMEOUT_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_REDIS_CONNECT_TIMEOUT_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "RUNTIME_REDIS_PREFIX": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "SERVICE_AUTH_SECRET": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "SERVICE_NAME": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "SSE_BROADCAST_BACKEND": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "SSE_REDIS_CHANNEL": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "SSE_REDIS_CONNECT_TIMEOUT_MS": {
    "present": true,
    "secret": false,
    "type": "int"
  },
  "VITE_API_URL": {
    "present": true,
    "secret": false,
    "type": "string"
  },
  "VITE_FF_AGENT_STATS_UI": {
    "present": true,
    "secret": false,
    "type": "enum"
  },
  "VITE_FF_GLOBAL_HIGHLIGHTS_V1": {
    "present": true,
    "secret": false,
    "type": "enum"
  }
}
```

## Notes
- Secret values are written only to the local env file.
- Do not commit the local env file.
