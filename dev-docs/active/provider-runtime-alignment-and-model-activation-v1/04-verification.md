# 04 Verification

## 2026-03-16

- `node .ai/skills/workflows/llm/llm-engineering/scripts/check-llm-config-keys.mjs`
  - pass
  - 期间先暴露出 `env/.env.example` 与 k8s secret templates 残留 `LLM_API_KEY`；修正后通过。
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
  - pass
  - providers=7, profiles=41, provider admission pools=4。
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py validate --root . --out dev-docs/active/provider-runtime-alignment-and-model-activation-v1/artifacts/env/03-validation-log.md`
  - pass
- `python3 -B -S .ai/skills/features/environment/env-contractctl/scripts/env_contractctl.py generate --root . --out dev-docs/active/provider-runtime-alignment-and-model-activation-v1/artifacts/env/04-context-refresh.md`
  - pass
  - 重新生成 `env/.env.example`、`docs/env.md`、`docs/context/env/contract.json`。
- `node .ai/tests/run.mjs --suite environment`
  - pass
- `pnpm exec vitest run src/backend/llm/__tests__/secret-resolver.test.ts src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-client.test.ts src/backend/services/__tests__/inference-profile-service.test.ts`
  - pass
  - 11 tests passed。
- `pnpm exec vitest run src/backend/llm/__tests__/llm-gateway.test.ts`
  - pass
  - 8 tests passed。
- `pnpm exec vitest run src/backend/llm/__tests__`
  - pass
  - 37 tests passed。
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts -t "PATCH /v1/agents/:agentId/inference-profile can collect shadow review evidence for admin"`
  - pass
  - admin control-plane `start -> collect -> approve` 闭环正常。
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts`
  - pass
  - 43 tests passed。
- `pnpm exec vitest run src/backend/services/__tests__/inference-profile-service.test.ts src/backend/runtime/__tests__/persona-observability.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts`
  - pass
  - 16 tests passed。
- `pnpm exec tsc --noEmit`
  - pass
- `git diff --check`
  - pass

## Pending

- live provider connectivity:
  - `glm-5`
  - `kimi-k2-0905-preview`
  - `kimi-k2-thinking`
  - `MiniMax-M2.5`
  - `hunyuan-2.0-instruct-20251111`
  - `hunyuan-2.0-thinking-20251109`
  - `doubao-seed-2-0-lite-260215`
  - `doubao-seed-2-0-pro-260215`
- ordered primary/secondary failover against real provider credentials after Bitwarden provisioning
