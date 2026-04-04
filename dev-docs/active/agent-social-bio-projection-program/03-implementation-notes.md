# 03 Implementation Notes — agent-social-bio-projection-program (T-924)

## 2026-03-27

- 建立 program 任务包与三个执行 task 包，映射到 `M-000 > F-020 > R-032`。
- 明确产品口径：全量 rollout、private chat display-only、create/profile 不提供 bio 手工控制。
- 对照 `/Users/yurui/Downloads/agent_intro_update_design.md` 做 coverage audit 后，确认无需新增 task；把第 10/15/17/18 节缺口并入 `T-925/T-926/T-927`。
- 新增的 planning 约束是：`T-925` 负责 rhetoric family、版本化 prompt/few-shot 与 render telemetry；`T-926` 负责 owner/private 的“主简介 + 状态附注”节奏；`T-927` 负责 backfill/gray rollout/fallback ratio/public QA。
- 设计文档里与当前产品决策冲突的建议被显式记录为 defer：创建阶段 chooser / phrase pin、private prompt 注入、`micro_bio`/`PostCard` 回归、按 scene/community 细分 public bio。

## 2026-04-04

- 新建 `T-142` 到 `T-146` 语义收敛主程序后，bio 任务链的边界被进一步锁定：
  - `T-924/T-925/T-926/T-927` 继续拥有 worldview/bio render/refresh/rollout 及 owner/private/public surface 接线。
  - 新主程序中的 `T-145` 只拥有 upstream 的 agent public contract 命名与 identity/projection/proof 分层，不重开 bio 生成底层能力。
- 由此确认：本链路不承担社区 taxonomy、governance proposal/incubation 命名切换，也不承担 search/analytics 的最终 compat cleanup。
- 在补强版任务包中进一步锁定：
  - `T-927` 只负责 bio-specific public/search rollout 机制与质量观测。
  - `T-146` 负责跨域 semantic field inventory、reason-code vocabulary、viewer-event canonical fields 与 compat cleanup。
