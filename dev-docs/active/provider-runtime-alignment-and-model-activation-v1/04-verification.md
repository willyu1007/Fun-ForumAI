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

- 2026-04-03:
  - `pnpm exec vitest run src/backend/llm/__tests__/secret-resolver.test.ts`
    - pass
    - 新增覆盖 deploy-time env alias 优先级，以及 staging runtime 禁止 Bitwarden fallback。
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
    - pass
    - providers=7, profiles=41, provider admission pools=4, prompt templates=17。
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/check-llm-config-keys.mjs`
    - pass
    - 发现 repo 内 22 个 in-scope `LLM_` / `RUNTIME_` key 引用，均已注册。
  - `pnpm exec tsc --noEmit`
    - pass
  - `pnpm exec vitest run src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/secret-resolver.test.ts src/backend/services/__tests__/inference-profile-service.test.ts src/backend/media/__tests__/media-semantic-service.test.ts`
    - pass
    - 38 tests passed。
  - `pnpm exec vitest run src/backend/services/__tests__/inference-profile-service.test.ts`
    - pass
    - 7 tests passed；新增覆盖 inference profile recompilation 会清空遗留 visible pin 持久化字段。
  - `git diff --check`
    - pass

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

## 2026-04-03 Runtime Contract Closeout

- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
  - pass
  - providers=7, profiles=41, routing policies=41, execution policies=15, adapter bindings=1, model capabilities=5。
- `pnpm exec vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/services/__tests__/inference-profile-service.test.ts src/backend/media/__tests__/media-semantic-service.test.ts`
  - pass
  - 37 tests passed。
  - `llm-gateway.test.ts` 现额外覆盖 `intent_scene_fit / voice_line_tier / profile_candidates / region_policy / headroom / health` 六个 route-order step，以及 merge precedence / merge trace / selected adapter+credential。
  - 追加覆盖 `headroom / health` 不再受不可用 credential pool 影响，`callsite-inventory.test.ts` 现会逐 callsite 校验 `local_override_fields` 与源码中的真实 override 字段一致。
- `pnpm exec tsc --noEmit`
  - pass

## 2026-04-03 Review Gate Closeout

- 代码复核后补修两类闭环问题：
  - runtime `headroom / health` 排序此前只看 provider/region/endpoint，未对齐 broker 的 `allowed_model_ids / scope_tags / blocked` 过滤；现已收口到共享 helper，route-order 真消费与实际 credential resolve 保持一致。
  - `callsite-inventory.ts` 中 private context extract/distill 之前错误指向 `hidden-private_digest-premium`；现已校正为 `hidden-private_digest-base`，并补上字段级 inventory guard。
- 结论：
  - `T-901` 的代码层 review gate 已满足：execution plan / route context / render trace 字段齐备，route_order / direct fallback / provider+model pricing 已被 runtime 真消费，visible pins 已不在主路径，callsite 双轨参数已有可交接 inventory。
  - 仍未关闭的仅剩非代码项：真实 provider connectivity / ordered failover live 验收，继续保留在 Pending。

## 2026-04-03 Deep Cleanup

- `pnpm exec vitest run src/backend/llm/__tests__/credential-broker.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/callsite-inventory.test.ts src/backend/services/__tests__/inference-profile-service.test.ts src/backend/media/__tests__/media-semantic-service.test.ts`
  - pass
  - 39 tests passed。
  - 覆盖 cleanup 后的 metadata-only provider auth fixture、route-order usable-pool guard、以及 inventory 字段级 handoff guard。
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
  - pass
- `pnpm exec tsc --noEmit`
  - pass
- `git diff --check`
  - pass

## 2026-04-04 Runtime Contract Hardening

- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
  - pass
  - providers=7, profiles=41, execution policies=17, adapter bindings=1, model pricing=18, model capabilities=18。
- `pnpm exec vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/runtime-override-state.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts scripts/lib/__tests__/launch-readiness.test.ts`
  - pass
  - 46 tests passed。
  - 追加断言所有 profile candidate 都具备 capability + pricing coverage，且 capability entry 显式包含 `modalities / response_modes`。
- `node --check scripts/verify-launch-readiness.mjs`
  - pass
- `node --check scripts/runtime-staging-closeout.mjs`
  - pass
- `pnpm exec tsc -b --pretty false`
  - pass
  - 之前暴露的 repo 既有基线问题（readonly config tests、auth challenge payload typing、未使用 helper）已一并清理。

## 2026-04-04 Review Gate Re-check

- 重新核对后，`T-901` 的 repo 侧 hard gap 已从“execution plan 主路径已成型，但 capability/pricing coverage 仍可能漂移”收口为“candidate capability/pricing coverage 已由 validator + loader + gateway 三层共同加硬”。
- 当前仍未关闭的只剩外部验收项：
  - 真实 provider connectivity / ordered failover；
  - `T-936` staging live closeout；
  - `T-935` staging API env-file compile 的真实 secret/STS 前提。
