# 01 Plan

## Phases
1. 恢复 feature flag wiring
2. 收敛前端 Stats 入口语义
3. 补测试并验证

## Detailed steps
- 接入 `FF_AGENT_STATS_*` 到 backend launch config。
- 清理前端过时的 Stats UI gate 语义和遗留测试。
- 在 `TabIntro` 中按新的塑造页结构固定展示 Stats 区域。
- 补充/更新前端配置测试、`TabIntro` 测试和 `StatsPanel` 测试。
- 运行定向 vitest / eslint，并记录结果。

## Risks & mitigations
- Risk: 只恢复了 UI，可后端仍然 404。
  - Mitigation: 同时修 frontend 与 backend flag wiring。
- Risk: 旧 task bundle / 测试仍按“flag off 即隐藏入口”理解，导致后续再把 gate 接回去。
  - Mitigation: 同步更新 task bundle 和记忆测试，改为校验后端不可用时的单点反馈。
