# 04 Verification

## Executed verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts` | pass (`11` files, `78` tests) |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts` | pass (`4` files, `44` tests) |
| `pnpm exec tsc --noEmit` | pass |

## Scenario checklist
- [x] memory-rich agent 在低预算 scene 中先降级 memory tier
- [x] `public_memory_budget` 不再作为最终 runtime ceiling
- [x] audit 能区分 memory-driven overflow 与 current-context-driven overflow
- [x] `budget_exceeded_due_to_privacy_and_memory_floor` 与 `hard_ceiling_enforced_memory_compacted` 可被稳定识别
- [x] owner/runtime divergence 可见且带 reason code
- [x] `MemoryContextRequest.bucketTarget` 始终先于最终 `tokenCeiling` 被计算和记录
- [x] `minimal_control_tokens > target_budget` 或 `current_context_guaranteed + minimal_control > target_budget` 会显式标记病态配置
- [x] disclosure 语义在 public/private scene 中保持正确
- [x] cohort evidence/sign-off 已外提到 `T-905`，不再阻塞本包 closure

## Package 2 review gate
- [x] 剩余 cohort review 结论已移交 `T-905`
- [x] 七个 overflow reason 已通过测试或人工验算确认语义边界
- [x] owner/runtime divergence reason codes 已和产品/调试使用场景对齐
- [x] attenuation verdict 由 `T-905` 统一给出；本包不再保留独立 open gap
- [x] 当前代码实现已允许进入 `T-116`；剩余空缺是 cohort 证据，不是 runtime authority 缺口

## Follow-up handoff
- `T-905 prompt-budget-v2-cohort-signoff-followup` 接管 six-scene cohort evidence、memory-rich attenuation verdict 和最终体验签收。

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
