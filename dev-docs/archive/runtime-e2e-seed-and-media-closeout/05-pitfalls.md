# 05 Pitfalls — runtime-e2e-seed-and-media-closeout (T-938)

## Do-not-repeat summary

- 不要把 local-kind 的多模态闭环只理解成 backend flag：
  - frontend build proof、seed 数据和 media persistence 任何一个缺失，最终都会表现成“功能像是没开”。
- 不要再把 local-kind media storage 继续描述成 pod-local disk：
  - 这轮已经切成 PVC-backed local storage，保留旧说法会误导后续 rollout 和副本策略判断。

## Resolved Pitfalls

- 2026-04-06: multimodal media 只在 backend runtime 开启，frontend build proof 仍可能关闭
  - Symptom: backend `/v1/admin/runtime/features` 显示 media flags 已开启，但前端入口仍缺失或表现像功能未开。
  - Root cause: local-kind / launch-like 交付链没有把 `VITE_FF_MULTIMODAL_AGENT_MEDIA_V1=true` 当成 build-proof 必须项。
  - What was tried: 先核对 backend runtime flags，再比对 frontend build proof 与 packaging profile。
  - Fix/workaround: 把 launch/local-kind 路径收紧为 backend 和 frontend 双侧都必须显式开启 multimodal media，并在 readiness / build proof 里校验。
  - Prevention: 以后所有 launch-like feature gate 都需要同时验证 runtime proof 和 frontend build proof，不能只看后端。

- 2026-04-06: fresh kind 环境缺少可直接用于 runtime/post 的 canonical seed 候选
  - Symptom: `/v1/dev/runtime/post` 在 fresh seed 后持续返回 `No stage-eligible posting candidates`。
  - Root cause: 旧 seed 只能保证 canonical roster/materialization，不保证存在 owner-private media candidate + active launch-core membership 的可发帖 agent。
  - What was tried: 先手工创建 live agent 验证链路，再回看 canonical seed fixture 与 image planner 入口约束。
  - Fix/workaround: 在 canonical seed 中补齐可复用的 owner-private media candidate，并把 local-kind staging 默认 seed 到可执行状态。
  - Prevention: 以后 runtime E2E seed 必须直接覆盖“能跑成功链路”的最低条件，而不是只覆盖 roster existence。
