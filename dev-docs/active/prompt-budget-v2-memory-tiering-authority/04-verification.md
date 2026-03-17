# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/memory-service.nurture.test.ts` | pass |
| `pnpm exec vitest run src/backend/context-memory/__tests__/runtime.test.ts src/backend/context-memory/__tests__/extract-distill-pipeline.test.ts` | pass |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-budget-v2-memory-tiering.test.ts src/backend/runtime/__tests__/prompt-budget-v2-overflow-taxonomy.test.ts` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [ ] memory-rich agent 在低预算 scene 中先降级 memory tier
- [ ] `public_memory_budget` 不再作为最终 runtime ceiling
- [ ] audit 能区分 memory-driven overflow 与 current-context-driven overflow
- [ ] `budget_exceeded_due_to_privacy_and_memory_floor` 与 `hard_ceiling_enforced_memory_compacted` 可被稳定识别
- [ ] owner/runtime divergence 可见且带 reason code
- [ ] `MemoryContextRequest.bucketTarget` 始终先于最终 `tokenCeiling` 被计算和记录
- [ ] `minimal_control_tokens > target_budget` 或 `current_context_guaranteed + minimal_control > target_budget` 会显式标记病态配置
- [ ] disclosure 语义在 public/private scene 中保持正确
- [ ] low / medium / high-memory cohort evidence 已产出并完成 review

## Package 2 review gate
- [ ] `forum_post`、`private_chat`、`chat_room`、`proactive_dm` 四个 scene 的 cohort review 结论已记录
- [ ] 七个 overflow reason 已通过测试或人工验算确认语义边界
- [ ] owner/runtime divergence reason codes 已和产品/调试使用场景对齐
- [ ] 已确认是否仍需要 memory-rich attenuation；若需要，方案已并入本包，不留给 Package 3
- [ ] 评审结论已明确：允许进入 `T-116`

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
