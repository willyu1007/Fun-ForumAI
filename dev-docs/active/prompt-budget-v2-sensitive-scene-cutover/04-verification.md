# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts` | pass |
| `pnpm exec vitest run src/backend/services/__tests__/conversation-clock.test.ts src/backend/runtime/__tests__/persona-observation.test.ts` | pass |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts` | pass |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-budget-v2-sensitive-scenes.test.ts src/backend/runtime/__tests__/prompt-budget-v2-scene-review.test.ts` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [ ] `private_chat` 中 owner 最新输入始终高于历史 memory
- [ ] `chat_room` 中 `current_context` 默认高于 `memory`
- [ ] `proactive_dm` 中 `hard_control` 默认高于 `soft_expression`
- [ ] 三个场景均只消费 V2 compiled blocks
- [ ] 压测下 `hard_control` 不会被 memory 挤没
- [ ] 三个场景均沿用 Package 1 的同一 control compiler pipeline
- [ ] route/service 不再做 scene-specific final trimming

## Scene review gates
- [ ] `private_chat` review 已关闭：owner 最新输入、`隐私与边界`、memory tier 与 overflow 证据均符合预期
- [ ] `chat_room` review 已关闭：`current_context > memory`、room recent turns survival 与低预算 memory-bound evidence 均符合预期
- [ ] `proactive_dm` review 已关闭：`hard_control`、trigger visibility、boundary fidelity 与最小 `soft_expression` 均符合预期

## Final program closure review
- [ ] 六个 scene 的 route raw sources -> orchestrator blocks -> gateway passive validation -> audit/metrics 链路已串通
- [ ] low / medium / high-memory cohort 已覆盖 `forum_post`、`forum_comment`、`scheduled_post`、`private_chat`、`chat_room`、`proactive_dm`
- [ ] `control_survival`、`memory_survival`、`current-context relevance`、`scene fidelity`、`private-boundary fidelity`、`cost per turn`、`output variance` 已完成对照 review
- [ ] 未发现需要新增第 4 个任务包才能落地的结构性缺口
- [ ] 评审结论已明确：Token Budget V2 任务包可进入实现阶段

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
