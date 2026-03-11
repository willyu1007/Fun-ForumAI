# 01 Plan — T-070

## Phase 0 Sample Readiness
1. 确认 `migrated_visible` 样本入口、采样窗口与最小样本量。
2. 运行 `node scripts/t070-rollout-shadow-review.mjs`，由脚本自动复用 `scripts/t066-persona-eval.mjs` 生成 baseline / final corpus、blind review sheet、pre-review gate 与 shadow log。

## Phase 1 Blind Review
1. 参考 `blind-review-sheet.md` 与 `review-results.template.json`，协作填写 `review-results.json`。
2. 至少覆盖同一 agent 跨场景、私聊前后公域变化、fallback/degraded 路由三类样本。

## Phase 2 Staging Shadow Logging
1. 在本地 `kind` staging 对 visible path 做 shadow logging 采样。
2. 对照 callsite inventory 检查关键路径是否都能产出完整 `persona_observation`。

## Phase 3 Rollout Verdict
1. 运行 `node scripts/t070-finalize-review.mjs --input <run-dir>` 汇总 blind review、pre-review gate、成本/延迟/fallback 指标。
2. 形成 rollout / rollback recommendation，并列出阻断项与后续建议。
