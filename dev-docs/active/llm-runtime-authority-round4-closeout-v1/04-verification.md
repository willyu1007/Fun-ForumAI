# 04 Verification

## Automated

- `pnpm exec vitest run src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-client.test.ts src/backend/llm/__tests__/runtime-authority-state.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/lib/config.test.ts`
  - Result: `7` files, `66` tests passed.
- `pnpm exec tsc --noEmit --pretty false`
  - Result: passed.
- `pnpm exec vitest run src/backend/media/__tests__/media-asset-service.test.ts src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/media-lifecycle-service.test.ts`
  - Result: `4` files, `19` tests passed.
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - Result: registry structurally and contractually valid.
- `node .ai/skills/workflows/llm/llm-engineering/scripts/check-llm-config-keys.mjs`
  - Result: all in-scope LLM config keys are registered.
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/llm-runtime-authority-round4-closeout-v1/03-validation-log.md`
  - Result: passed.

## Local Kind Runtime

- Deploy command:
  - `DASHSCOPE_API_KEY='bad-primary-key' DASHSCOPE_API_KEY_SECONDARY='***valid***' MEDIA_GENERATION_API_KEY='***valid***' pnpm k8s:staging:local -- --k8s-context kind-funforum --skip-db-migrate --seed-profile canonical`
- Verified rollout:
  - backend pod `backend-5bfb7c994f-hrp2j`
  - runtime fingerprint `sha256:dcf1fd0c6d049fb015a98b455468929382c533b684aac40f1bea7459f1a0cce8`
- Verified runtime admin state through `http://127.0.0.1:4103`:
  - `routing_mode=policy_driven`
  - `env_pins_present=false`
  - `debug_signals_present=false`
  - `fingerprint_basis` now includes `src/backend/llm/llm-client.ts`, `src/backend/llm/providers/openai-compatible.ts`, `src/backend/llm/registry-loader.ts`, `adapter_bindings.yaml`, `credential_pools.yaml`, `execution_policies.yaml`, `model_capabilities.yaml`, `model_pricing.yaml`, `prompt_templates.yaml`, and `routing_policies.yaml`
- Verified health ordering:
  - with `dashscope-primary.health=degraded` and `dashscope-secondary.health=healthy`, private-reply closeout selected `credential_id=dashscope-secondary`
- Verified bad credential isolation:
  - with invalid primary DashScope key and valid secondary DashScope key, private-reply closeout succeeded on `credential_id=dashscope-secondary`
  - `fallback_history` recorded one DashScope auth failure for the bad credential and did not reuse that credential later in the same request chain

## Chrome DevTools

- Opened direct agent chat route on local kind: `http://127.0.0.1:4103/agents/8c86ca6a-0b7a-43ed-964f-0b00f69c7a50/chat`
- Sent real private message: `Round4 redeploy verification`
- Verified:
  - `POST /v1/agents/8c86ca6a-0b7a-43ed-964f-0b00f69c7a50/chat/sessions/cmnf74ydu00800mjvvjy66b0q/messages` returned `200`
  - UI rendered the human message and the agent reply
  - backend ledger for trace `private-chat:cmnf74ydu00800mjvvjy66b0q:cmns41yyz0a5m0mmx8gwfgx13` ended on `credential_id=dashscope-secondary`
  - `fallback_history` recorded auth failures for the invalid primary path and did not reuse the failed DashScope credential

## Notes

- The previously observed background media error (`media_context_projections_binding_id_fkey`) is now covered by targeted service tests and code hardening in the semantic-refresh path.
- Expected `AuthError` noise remains in the recorded local-kind verification because the rehearsal intentionally left non-selected provider credentials invalid.
