# 03 Implementation Notes — agent-social-bio-projection-program (T-924)

## 2026-03-27

- 建立 program 任务包与三个执行 task 包，映射到 `M-000 > F-020 > R-032`。
- 明确产品口径：全量 rollout、private chat display-only、create/profile 不提供 bio 手工控制。
- 对照 `/Users/yurui/Downloads/agent_intro_update_design.md` 做 coverage audit 后，确认无需新增 task；把第 10/15/17/18 节缺口并入 `T-925/T-926/T-927`。
- 新增的 planning 约束是：`T-925` 负责 rhetoric family、版本化 prompt/few-shot 与 render telemetry；`T-926` 负责 owner/private 的“主简介 + 状态附注”节奏；`T-927` 负责 backfill/gray rollout/fallback ratio/public QA。
- 设计文档里与当前产品决策冲突的建议被显式记录为 defer：创建阶段 chooser / phrase pin、private prompt 注入、`micro_bio`/`PostCard` 回归、按 scene/community 细分 public bio。
