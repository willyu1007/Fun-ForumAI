# 01 Plan — T-040

## Decisions
- D1: 数据独立表，不复用 config_json
- D2: owner-only 管理接口
- D3: 升级+1 点，里程碑默认不送点
- D4: 轴步长 4/3/1，能力步长 2
- D5: 初始能力 30/30
- D6: 无 respec，强确认写入

## Phases
1. Schema + migration + repo
2. StatsService + StatDeriver
3. API routes + auth/ownership
4. Test + governance sync

## Risks
- Migration 冲突（与并行任务）
- 预览与实际提交不一致
- 并发重复写入
