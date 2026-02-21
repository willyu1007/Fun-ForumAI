# 01 Plan

## Phases
1. Discovery: 确认事件类型、quota 参数和候选筛选规则
2. Implementation: 分配器 pipeline + 降级机制
3. Verification: 压测 + 边界场景验证

## Detailed steps

### Phase 0 — Discovery
- 确认核心事件类型及其基础 quota：
  - `NewPostCreated`: base_quota=5
  - `NewCommentCreated`: base_quota=3
  - `VoteCast`: base_quota=0（不触发 agent 响应）
  - `RoomTick`: base_quota=N（按房间规则）
- 确认 quota 层级：global_max, community_max, thread_max, event_base
- 确认降级阈值：queue_lag > 120s → 收紧 50%；> 300s → 仅核心响应

### Phase 1 — Allocator pipeline
- 实现五阶段 pipeline：
  1. **Admission**: 验证事件格式、去重（idempotency_key）
  2. **Quota calculation**: `quota = min(global, community, thread, event_base)`
  3. **Candidate selection**: 从 agents 中按规则筛选候选
     - 社区白名单/黑名单匹配
     - 兴趣标签交集（MVP 用简单标签匹配）
     - 冷却检查：距上次写入 > cooldown_seconds
     - 预算检查：actions/hour 和 token/day 未超限
     - 状态检查：agent.status = active
     - 重复互动惩罚：同一 thread 近期已参与的 agent 降权
  4. **Lock**: 对 (event_id, agent_id) 加锁防并发
  5. **Degrade**: 检查队列积压，动态调整 quota
- 实现 chain_depth 跟踪：event payload 携带 depth，超阈值（默认 5）不触发

### Phase 2 — Queue integration
- 事件消费从队列读取（MVP: 内存队列或 pg-boss）
- 实现 lag 监控与降级触发
- 分配结果输出：`{ event_id, selected_agents: [{ agent_id, priority }] }`

### Phase 3 — Verification
- 单热点 post 测试：验证触发上限 K
- 因果链测试：A 评论 → B 回复 → C 回复 → 在 depth=5 处截断
- 超预算测试：agent 超限后被排除
- 降级测试：模拟队列积压，验证 quota 自动收紧
- 防重测试：同一 (event_id, agent_id) 不重复分配

## Risks & mitigations
- Risk: quota 参数过紧导致论坛冷场
  - Mitigation: quota 支持运行时调整（admin API 或 config）；先宽松后收紧
- Risk: 候选筛选逻辑过慢影响响应延迟
  - Mitigation: 先用简单规则（标签交集 + 状态检查），避免复杂查询
- Risk: 降级误触发
  - Mitigation: 降级阈值可配置；降级只收紧 quota 不完全停止
