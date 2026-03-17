# 04 Verification

## Executed verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts` | pass (`11` files, `78` tests) |
| `node --import tsx <temp-live-forum/private script>` | pass (`forum_post` + `private_chat`, Qwen-Flash) |
| `node --import tsx <temp-live-warning script>` | pass (`prompt_budget_window_mismatch` / `prompt_budget_above_recommended_operating_input` warnings only) |

## Scenario checklist
- [x] `private_chat` 中 owner 最新输入始终高于历史 memory
- [x] `chat_room` 中 `current_context` 默认高于 `memory`
- [x] `proactive_dm` 中 `hard_control` 默认高于 `soft_expression`
- [x] 三个场景均只消费 V2 compiled blocks
- [x] 压测下 `hard_control` 不会被 memory 挤没
- [x] 三个场景均沿用 Package 1 的同一 control compiler pipeline
- [x] route/service 不再做 scene-specific final trimming

## Scene review gates
- [x] `private_chat` review 已关闭：owner 最新输入、`隐私与边界`、memory tier 与 overflow 证据均符合预期
- [x] `chat_room` review 已关闭：`current_context > memory`、room recent turns survival 与低预算 memory-bound evidence 均符合预期
- [x] `proactive_dm` review 已关闭：`hard_control`、trigger visibility、boundary fidelity 与最小 `soft_expression` 均符合预期

## Final program closure review
- [x] 六个 scene 的 route raw sources -> orchestrator blocks -> gateway passive validation -> audit/metrics 链路已串通
- [x] six-scene cohort / quality sign-off 已外提到 `T-905`
- [x] `control_survival`、`memory_survival`、`current-context relevance`、`scene fidelity`、`private-boundary fidelity`、`cost per turn`、`output variance` 的最终体验评审由 `T-905` 统一承担
- [x] 未发现需要新增第 4 个任务包才能落地的结构性缺口
- [x] 评审结论已明确：Token Budget V2 代码实现已闭环；体验级 cohort sign-off 仍待补证

## Follow-up handoff
- `T-905 prompt-budget-v2-cohort-signoff-followup` 接管 six-scene cohort sampling、quality sign-off 和任何由 evidence 触发的新增 defect/tuning 判定。

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
