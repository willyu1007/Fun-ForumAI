# 05 Pitfalls

## Do Not Repeat

- 不要把 registry 中已声明的 provider 当成 runtime 已接入；`providers.yaml` 与 `LlmClient`/adapter dispatch 必须同时成立。
- 不要把全局 observability snapshot 当成单 agent shadow compare evidence。
- 不要把 provider 官方 model_id 再包一层 repo 内别名，否则 admission/profile/pricing 会持续漂移。
- 删除 legacy env key 时，不要只改 contract；`env/.env.example`、k8s secret templates、local helper scripts 也会被 config-key check 扫到，必须一并收口。

## 2026-04-03 Route-Order / Inventory Drift

- symptom:
  - `headroom / health` 排序能被 broker 实际不会选中的 credential pool 影响，inventory 里 private extract/distill 也一度指向了错误 policy。
- root cause:
  - route-order 评分逻辑没有复用 broker 的 usable-pool 过滤；同时 inventory 只校验“有 localOverrides 调用点”，没有校验字段与目标 policy 的精确映射。
- what was tried:
  - 先补 route-order 测试，暴露 `allowed_model_ids / scope_tags` 对排序的伪信号；再对照 `context-memory/runtime.ts` 的 `requestedTier` 复核 inventory。
- fix/workaround:
  - 把 `headroom / health` 收口到共享的 usable-pool helper；把 private extract/distill 改回 `hidden-private_digest-base`；给 inventory 增加字段级 guard。
- prevention note:
  - 任何 execution-plan / credential / inventory 合同变更都必须同时满足三层一致性：runtime 真实消费、测试 fixture 同步、task bundle handoff 语义同步。只改其中一层会在后续双轨开发里重新引入漂移。
