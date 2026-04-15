# 01 Plan

## Phases
1. 恢复 feature flag wiring
2. 恢复前端 Stats 入口门控
3. 补测试并验证

## Detailed steps
- 接入 `VITE_FF_AGENT_STATS_UI` 到 frontend flags 和 capabilities。
- 接入 `FF_AGENT_STATS_*` 到 backend launch config。
- 在 `TabIntro` 中按 `agentStatsUiEnabled` 控制 `塑造` tab 的 Stats 暴露。
- 补充/更新前端配置测试与 `TabIntro` 测试。
- 运行定向 vitest / eslint，并记录结果。

## Risks & mitigations
- Risk: 只恢复了 UI，可后端仍然 404。
  - Mitigation: 同时修 frontend 与 backend flag wiring。
- Risk: flags off 时仍残留半暴露入口。
  - Mitigation: 增加 flag-off 回归测试。
