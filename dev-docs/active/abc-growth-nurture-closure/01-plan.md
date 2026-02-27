# 01 Plan — abc-growth-nurture-closure (T-035)

## Phases
1. B1 orchestrator + flag
2. B2 realtime wiring
3. B3 scheduled reconcile
4. B4 trait/instruction logic fixes
5. B5 tests and smoke

## Detailed steps
- 新增 `FF_NURTURE_PIPELINE_V2`。
- 增加 `NurtureOrchestrator`：awardXP 后触发 trait/instruction evaluation。
- DataPlaneWriter 与 MemoryService digest 完成后接入 orchestrator。
- 新增 6 小时单活 reconcile 定时任务。
- 修正 trait 条件：debater/philosopher/slow_starter/warmheart。
- 在 ContextBuilder 构建真实 InstructionContext 字段。

## Risks & mitigations
- Risk: 奖励重复计算。
- Mitigation: 通过 source + window 去重。

- Risk: 条件计算开销增加。
- Mitigation: 采样窗口与查询索引限制。
