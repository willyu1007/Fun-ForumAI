# E2E Example 01 — Add a provider (OpenAI-style) end-to-end

## Scenario
You need to integrate a new LLM provider behind a single calling surface, using **implicit credentials** and **registry-first** identifiers.

- User request (example): "Add OpenAI as an LLM provider for code generation. Do not expose API keys to feature code."
- Chosen workflow: `../procedures/add-provider.md`

## Inputs you must have
- `provider_id`: `openai`
- Auth strategy: provider metadata declares `source=credential_pool` + `auth_strategy`, and actual secrets live only in credential pools
- APIs needed: chat (streaming optional)
- Rollout: start with canary (profile-gated)

## End-to-end steps
1) **Register provider (SSOT)**
   - Edit: `.ai/llm-config/registry/providers.yaml`
   - Add an entry like:

```yaml
- provider_id: openai
  display_name: OpenAI
  gateway_kind: openai_compatible
  auth:
    type: api_key
    source: credential_pool
    auth_strategy: bearer_api_key
  capabilities:
    chat: true
    json_mode: true
    tool_calling: false
    streaming: true
  routing:
    regions: [global]
    default_region: global
  defaults:
    timeout_ms: 60000
    max_retries: 1
```

2) **Register credential pools for runtime auth truth**
   - Edit: `.ai/llm-config/registry/credential_pools.yaml`
   - Add one or more pools like:

```yaml
- credential_id: openai-primary
  provider_id: openai
  region: global
  endpoint_id: openai-global
  endpoint: https://api.openai.com/v1
  credential_ref: secret-ref:openai_api_key_primary
  priority: 10
  health: healthy
  enabled: true
  scope_tags: [visible]
  allowed_model_ids: [gpt-4.1-mini]
```

3) **Register any new in-scope keys (if you introduce them)**
   - Edit: `.ai/llm-config/registry/config_keys.yaml`
   - Example keys (only if your wrapper needs them):
     - `OPENAI_API_BASE`
     - `OPENAI_ORG_ID`

4) **Implement adapter in your project (repo-specific)**
   - Create/extend your **single calling surface**:
     - `LLMClient` / `LLMGateway` / `llm_wrapper`
   - Add `OpenAIAdapter` inside that surface (feature code must not import SDKs).
   - Requirements:
     - canonical request envelope → provider request
     - normalized response + normalized errors
     - telemetry fields: `provider_id`, `model_id`, `profile_id`, `prompt_template_id`, `prompt_version`, `tenant_id`, `user_id`, `trace_id`

5) **Add a profile that can route to the new provider (optional but recommended)**
   - Edit: `.ai/llm-config/registry/model_profiles.yaml`
   - Example (canary profile):

```yaml
- profile_id: codegen_canary
  intent: code_generation
  candidates:
    - provider_id: openai
      model_id: gpt-4.1-mini
      weight: 100
```

6) **Add/upgrade a prompt template (optional)**
   - Edit: `.ai/llm-config/registry/prompt_templates.yaml`
   - Use `(prompt_template_id, version)` (immutable versioning).

## Verification
Run from repo root:

- Registry sanity (recommended):
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
- Config key gate (required if any new in-scope key was introduced):
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/check-llm-config-keys.mjs`
- Run the smallest adapter/wrapper test suite available in your repo.

## Expected outputs
- Updated SSOT registries under `.ai/llm-config/registry/*`
- New adapter implementation under your single calling surface
- Contract tests + telemetry
