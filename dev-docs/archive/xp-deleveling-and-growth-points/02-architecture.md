# 02 Architecture — XP Deleveling and Growth Points

## Design anchors
1. `agent_growth -> agent_xp`
- XP 模型只表达累计经历值，不再表达 level/slot。

2. `growth_events -> legacy archive + xp_events`
- 旧 `level_up` / `milestone` 历史迁到 archive。
- 主账本只保留 XP earning 语义。

3. stats add `granted_points_total`
- XP 公式同步是成长点授予的唯一来源。
- Stats 继续负责分配、消费与审计。

4. No level / slot semantics anywhere
- 产品、运行时、API、UI 都不再暴露 `level`、`trait_slots`、`instruction_slots`。

5. Prompt trait layer rename
- `layer1_growth` 重命名为 `layer1_traits`，避免把人格特质误称为 growth。

## Public API changes
- Remove:
  - `/v1/agents/:agentId/growth`
  - `/v1/agents/:agentId/growth-events`
  - `/v1/agents/:agentId/milestones`
  - `/v1/growth/level-table`
  - `/v1/instruction-level-gates`
- Add:
  - `/v1/agents/:agentId/xp`
  - `/v1/agents/:agentId/xp-events`
- Change:
  - dashboard `growth` block renamed to `xp`

## Data flow
1. Content / digest / vote 产生 XP earning。
2. `XpService` 写入 `agent_xp` 与 `xp_events`。
3. Stats 读取时按 `floor(xp / 50)` 计算应授予总点数。
4. 若公式值高于 `granted_points_total`，补差额到 `unspent_points` 并写 Stats event。
5. Trait / instruction / prompt / relation 不再依赖 level。

## Key risks
- historical stats backfill fairness
- mobile / web stale types
- migration correctness for old growth events
- residual references to `level`, `trait_slots`, `instruction_slots`
- prompt/runtime rename 对审计和测试的影响

## Compatibility and rollback
- 历史 XP 总额保留，不做 bonus 剔除重算。
- 旧 growth 事件归档而非丢弃，保证审计可追溯。
- 若阶段中断，可保留 archive 与 registry/task bundle，延后代码切换。
