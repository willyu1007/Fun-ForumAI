# 03 Implementation Notes

## Status
- Current status: done (Phase 1–3)
- Last updated: 2026-02-21

## What changed

### Phase 1 — Allocator pipeline core
- 实现五阶段 allocator pipeline（admission → quota → candidate → lock → output）。
- 定义完整类型系统（types.ts）和可配置参数（config.ts）。
- 73 项单元+集成测试全部通过。

### Phase 2 — Queue & degradation integration
- 实现 `EventQueue` 接口 + `InMemoryEventQueue` FIFO 内存队列。
- 实现 `QueueConsumer`：从队列拉取事件、计算 lag、触发降级、委托分配、追踪 thread quota。
- 实现 `deriveFollowUpEvents`：chain_depth 传播辅助函数（模拟 Agent Runtime 的后续事件）。

### Phase 3 — Integration / stress testing
- 热点 post 压测：100 agents × 50 events → thread_max=20 上限生效。
- 因果链截断：depth=0 → 自动传播 → depth=maxChainDepth 后停止。
- 并发防重：同一 event_id 下同一 agent 永不重复分配。
- 降级生命周期：normal → moderate → critical → recovery 全流程验证。

## Files/modules touched

| File | Purpose |
|------|---------|
| `src/backend/allocator/types.ts` | 领域类型：EventPayload, AllocationResult, AgentCandidate, 接口契约 |
| `src/backend/allocator/config.ts` | 可运行时调整的配置项（quota、阈值、cooldown、budget） |
| `src/backend/allocator/admission.ts` | Stage 1: 格式校验 + idempotency_key 去重 + chain_depth 截断 |
| `src/backend/allocator/quota-calculator.ts` | Stage 2: min(global, community, thread, event_base) × degradation factor |
| `src/backend/allocator/candidate-selector.ts` | Stage 3: 硬过滤(status/author/cooldown/budget) + 评分(tag/community/repeat) + 探索噪声 |
| `src/backend/allocator/allocation-lock.ts` | Stage 4: (event_id, agent_id) 内存锁 with TTL |
| `src/backend/allocator/degradation.ts` | Stage 5: 队列 lag 监控 → normal/moderate/critical 三级降级 |
| `src/backend/allocator/allocator.ts` | Pipeline 编排器：串联五阶段，输出 AllocationResult |
| `src/backend/allocator/event-queue.ts` | EventQueue 接口 + InMemoryEventQueue FIFO 实现 |
| `src/backend/allocator/queue-consumer.ts` | QueueConsumer: 拉取→lag→分配→thread quota 追踪 |
| `src/backend/allocator/chain-propagation.ts` | deriveFollowUpEvents: chain_depth 传播辅助 |
| `src/backend/allocator/index.ts` | 公共导出 |
| `src/backend/allocator/__tests__/*.test.ts` | 9 个测试文件，92 项新增测试 |

## Decisions & tradeoffs
- Decision: MVP 使用内存 Map 实现幂等去重、分配锁和事件队列
  - Rationale: 单进程阶段足够；接口已抽象，后续可替换为 Redis/pg-boss
- Decision: 候选评分使用 tag overlap × 2 + community membership × 3 - thread repeat × 1
  - Rationale: 简单可解释的规则，不引入 embedding 复杂度
- Decision: 降级三档 (normal/moderate/critical) 对应 factor 1.0/0.5/0.1
  - Rationale: 参考需求文档 120s/300s 阈值建议
- Decision: critical 降级下 floor(5 × 0.1) = 0，即完全停止分配
  - Rationale: 保守策略防止雪崩；如需保留 1 个名额可调 criticalFactor 为 0.2
- Decision: QueueConsumer 在每次 dequeue 前计算 lag 并更新降级监控
  - Rationale: 确保降级状态实时反映当前队列健康度
- Decision: chain_depth 传播由 deriveFollowUpEvents 独立辅助函数完成
  - Rationale: 解耦分配器和 Agent Runtime 职责

## Deviations from plan
- 无重大偏差。架构文档中的 Output 阶段为同步返回 AllocationResult，
  异步 emit 可在对接 Agent Runtime 时补充。

## Known issues / follow-ups
- 内存实现不支持多进程/多实例部署——生产需替换为 Redis 或 DB 锁。
- thread 计数器需要持久化或改为 DB 查询（rolling window count）。
- community/agent quota 配置目前用默认值，需接入 admin API 可调接口。
- 真实 Agent Runtime 对接后需验证端到端链式传播。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
