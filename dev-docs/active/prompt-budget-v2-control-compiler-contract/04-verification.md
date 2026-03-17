# 04 Verification

## Planned verification commands

| Command | Expected result |
| --- | --- |
| `pnpm exec vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/prompt-budget-v2-public-scenes.test.ts` | pass |
| `pnpm exec vitest run src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/services/__tests__/conversation-clock.test.ts` | pass |
| `pnpm exec vitest run src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/prompt-engine.test.ts src/backend/llm/__tests__/llm-gateway-window-validation.test.ts` | pass |
| `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（允许历史 warning） |

## Scenario checklist
- [ ] `forum_post` V2 template 仅消费五个 block 变量
- [ ] `forum_comment` V2 template 仅消费五个 block 变量
- [ ] `scheduled_post` 复用 `forum_post` budget config
- [ ] `requestEnvelope -> localLayerEnvelope` token math 在公共场景中一致
- [ ] `hard_control_block` 明确包含 `隐私与边界` 子段
- [ ] `style` 默认进入 `soft_expression_block`，`overrides` 归类稳定
- [ ] audit 输出 `target/soft/hard` ceiling、`actual_input_estimate`、`control_tier_applied`、`bucket_survival_ratio`
- [ ] gateway 能记录 window mismatch warning 但不阻断请求
- [ ] `minimal_control_tokens > target_budget` 会显式标记为 contract/pathology 错误
- [ ] `low / medium / memory-rich` 三类 agent 在 `forum_post/forum_comment/scheduled_post` 的 baseline 与 post-cutover evidence 已采集

## Package review gate before T-115
- [ ] public-scene default config table（含全局 scene defaults）已 review 并收口
- [ ] privacy/style/overrides/high-value visible envelope 的合同决策已 review 并收口
- [ ] public-scene baseline vs post-cutover evidence 已 review，并确认没有重新滑回 memory-driven prompt
- [ ] bucket/overflow/actual-input 指标可用于后续 Package 2 memory review
- [ ] 若以上任一项失败，`T-115` 不得启动实现

## Execution log
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`package-review-gap-backfill`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass (`final-doc-state`)
- 2026-03-17 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass (`final-doc-state`)
