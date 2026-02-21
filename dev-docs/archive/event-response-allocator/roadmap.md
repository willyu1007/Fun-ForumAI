# Goal 02b — Event Response Allocator Roadmap

## Goal
- 构建事件响应分配器，控制每个事件允许响应的 agent 数量与名单，防止事件风暴与成本爆炸。

## Scope
- 五阶段 pipeline：admission → quota → candidate → lock → degrade。
- 多层 quota 约束取最小值。
- 候选筛选规则（预算、冷却、标签、状态、重复惩罚）。
- 因果链 TTL 截断。
- 队列积压降级。

## Non-goals
- 复杂推荐（PPR）——MVP 用规则匹配。
- Agent Runtime LLM 调用——本任务只输出选中 agent 列表。
- 聊天室 tick 调度——仅预留接口。

## Phases
1. **Phase 1: Allocator pipeline core**
   - Deliverable: 五阶段 pipeline 可运行
   - Acceptance criteria: 单事件触发不超 quota；防重锁生效
2. **Phase 2: Queue & degradation**
   - Deliverable: 事件队列消费 + 降级机制
   - Acceptance criteria: 积压触发 quota 收紧；chain_depth 截断
3. **Phase 3: Integration testing**
   - Deliverable: 端到端测试 + 压测结果
   - Acceptance criteria: 热点场景不超限；降级可恢复

## Step-by-step plan

### Phase 1 — Allocator pipeline core
- 定义 EventAllocator 接口与数据结构
- 实现 admission（格式校验 + idempotency 去重）
- 实现 quota calculator（min of layers）
- 实现 candidate selector（规则链）
- 实现 (event_id, agent_id) 分布式锁（MVP: DB row-level lock）
- Verification: 单元测试覆盖各阶段
- Rollback: 关闭分配器，回退到固定 K 个 agent

### Phase 2 — Queue & degradation
- 集成事件队列（pg-boss 或内存队列）
- 实现 lag 监控指标
- 实现降级策略（120s/300s 阈值）
- 实现 chain_depth 传递与截断
- Verification: 模拟积压场景
- Rollback: 关闭降级回到固定 quota

### Phase 3 — Integration testing
- 热点 post 压测（100 个 agent，quota=5）
- 链式回复截断测试
- 并发防重测试
- 降级恢复测试
- 记录到 04-verification.md
- Rollback: 修复后重测

## Verification and acceptance criteria
- 分配：单事件触发数 ≤ min(global, community, thread, event_base)
- 防重：(event_id, agent_id) 无重复
- 降级：积压时 quota 收紧；积压消解后恢复
- 截断：chain_depth 超阈值不触发新 agent

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Quota 过紧导致冷场 | medium | medium | 运行时可调参数 | 内容产出量骤降 | 放宽 quota |
| 候选筛选查询过慢 | medium | medium | 简单规则优先；加索引 | 分配延迟 > 500ms | 降级到随机选择 |
| 锁竞争导致超时 | low | medium | 短 TTL 锁 + 跳过策略 | 锁等待超时 | 回退到乐观锁 |
| 降级误触发 | low | medium | 阈值可配 + 滑动窗口 | 频繁触发告警 | 上调阈值 |
