# 04 Verification

## Executed verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/services/__tests__/memory-service.context-memory.test.ts src/backend/services/__tests__/private-channel-service.test.ts src/backend/services/__tests__/proactive-interaction-service.test.ts src/backend/services/__tests__/conversation-clock.test.ts src/backend/runtime/__tests__/persona-observation.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts` | pass (`11` files, `78` tests) |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts` | pass (`4` files, `44` tests) |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm exec eslint src/backend/runtime/prompt-orchestrator.ts src/backend/llm/prompt-engine.ts src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/llm/__tests__/prompt-engine.test.ts` | pass |
| `node --import tsx <temp-live-forum/private script>` | pass (`forum_post` + `private_chat`, Qwen-Flash) |
| `node --import tsx <temp-live-warning script>` | pass (`prompt_budget_window_mismatch` / `prompt_budget_above_recommended_operating_input` warnings only) |

## Scenario checklist
- [x] `forum_post` V2 template 仅消费五个 block 变量
- [x] `forum_comment` V2 template 仅消费五个 block 变量
- [x] `scheduled_post` 复用 `forum_post` budget config
- [x] `requestEnvelope -> localLayerEnvelope` token math 在公共场景中一致
- [x] `hard_control_block` 明确包含 `隐私与边界` 子段
- [x] `style` 默认进入 `soft_expression_block`，`overrides` 归类稳定
- [x] audit 输出 `target/soft/hard` ceiling、`actual_input_estimate`、`control_tier_applied`、`bucket_survival_ratio`
- [x] gateway 能记录 window mismatch warning 但不阻断请求
- [x] `minimal_control_tokens > target_budget` 会显式标记为 contract/pathology 错误
- [ ] `low / medium / memory-rich` 三类 agent 在 `forum_post/forum_comment/scheduled_post` 的 baseline 与 post-cutover evidence 已采集

## Package review gate before T-115
- [x] public-scene default config table（含全局 scene defaults）已 review 并收口
- [x] privacy/style/overrides/high-value visible envelope 的合同决策已 review 并收口
- [ ] public-scene baseline vs post-cutover evidence 已 review，并确认没有重新滑回 memory-driven prompt
- [x] bucket/overflow/actual-input 指标可用于后续 Package 2 memory review
- [x] 当前代码实现不再阻塞 `T-115`；剩余空缺是行为证据，而不是 authority / contract 缺口

## Follow-up handoff
- `T-905 prompt-budget-v2-cohort-signoff-followup` 接管 public-scene cohort baseline / post-cutover evidence 和体验级 review。

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
