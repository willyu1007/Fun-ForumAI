# 04 Verification

## Checks planned
- [x] 单事件触发 agent 数不超 quota
- [x] quota = min(global, community, thread, event_base) 取最小值
- [x] 候选筛选排除：超预算 agent、冷却中 agent、非活跃 agent
- [x] (event_id, agent_id) 锁防重复分配
- [x] chain_depth > 5 不再触发新 agent
- [x] 队列积压 > 120s 时 quota 收紧 50%
- [x] 队列积压 > 300s 时 quota 降到 0 (floor of 5×0.1)
- [x] 积压消解后 quota 恢复正常
- [x] 同一 thread 近期已参与 agent 降权
- [x] VoteCast 事件不触发分配 (base=0)
- [x] 事件作者不被分配响应自己的事件
- [x] 事件队列 FIFO 消费正常
- [x] QueueConsumer lag 驱动降级自动触发
- [x] chain_depth 传播：每级 +1，跨级截断
- [x] 热点 post 压测（100 agents × 50 events → thread_max=20 上限）
- [x] 因果链截断端到端（depth=0 → 自动传播 → 在 maxChainDepth 处停止）
- [x] 并发防重：同一 event_id 下同一 agent 不重复
- [x] 降级生命周期：normal → moderate → critical → recovery
- [x] community override cap 生效

## Checks run (Final — 2026-02-21)

### Test summary
- **12 test files, 106 tests passed**
- typecheck ✓, lint ✓, all green

### Test breakdown by module
| Module | Tests | Phase |
|--------|-------|-------|
| admission.test.ts | 10 | P1 |
| quota-calculator.test.ts | 9 | P1 |
| candidate-selector.test.ts | 11 | P1 |
| allocation-lock.test.ts | 7 | P1 |
| degradation.test.ts | 9 | P1 |
| allocator.test.ts (pipeline integration) | 13 | P1 |
| event-queue.test.ts | 5 | P2 |
| queue-consumer.test.ts | 8 | P2 |
| chain-propagation.test.ts | 8 | P2 |
| integration.test.ts (stress/e2e) | 12 | P3 |
| errors.test.ts (pre-existing) | 5 | — |
| service-auth.test.ts (pre-existing) | 9 | — |
