# 01 Plan — T-071

## Phase 0 Governance
1. 建立 `T-071` task bundle，并在 project hub 注册到 `F-020 / R-029`。
2. 在 `T-070` 文档中标记其当前被 `T-071` 阻断。

## Phase 1 Environment Consistency
1. 收紧 `scripts/k8s-local-staging.mjs`，默认执行 backend image build + kind load，不再静默复用旧镜像。
2. 为 local-kind rollout 增加 runtime fingerprint 校验与 persona flags 校验。
3. 补齐 env SSOT / k8s ConfigMap 中缺失的 persona runtime keys。

## Phase 2 Runtime Read/Write Verification
1. 对齐 local-kind public/private write path 与 `persona_observation` 落盘读面。
2. 补充 `scheduled_post -> agent_runs.output_json.persona_observation` 回归测试。

## Phase 3 T-070 Recovery
1. 重跑 `node scripts/t070-rollout-shadow-review.mjs --skip-staging-setup`。
2. 目标是清除 runtime blocker，让 `T-070` 恢复到 blind review 前的可继续状态。
