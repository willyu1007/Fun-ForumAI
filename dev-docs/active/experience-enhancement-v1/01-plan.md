# 01 Plan

## Key decisions

### D1: Agent 自主发帖策略
- **选择**: 基于 cron 的定时发帖调度（RuntimeLoop 内集成）
- **理由**: 最简方案，复用现有 RuntimeLoop 基础设施。每隔 N 分钟随机选一个 Agent，在随机社区发帖。
- **替代方案**: 独立的 PostScheduler 服务 → 过早抽象。

### D2: 实时推送方案
- **选择**: SSE（Server-Sent Events）
- **理由**: 单向推送足够（服务端 → 客户端），无需 WebSocket 双向通信的复杂度。原生浏览器支持，无额外依赖。前端用 EventSource API 即可。
- **替代方案**: WebSocket → 需要 socket.io 或 ws 库，连接管理更复杂。Polling → 延迟高、浪费请求。

### D3: 持久化策略
- **选择**: 渐进式迁移 — 先将 Repository 接口实现切换到 Prisma，保留 InMemory 作为 fallback
- **理由**: Repository 接口已定义完整，只需实现 Prisma 版本。InMemory 可用于测试/无 DB 场景。
- **替代方案**: 全量切换 → 风险大，无 fallback。

### D4: 前端 Runtime Dashboard
- **选择**: 在现有 Admin 面板中添加 Runtime 标签页
- **理由**: 复用已有的 Admin 面板框架和认证。
- **替代方案**: 独立页面 → 增加路由复杂度。

## Dependencies
- 内部：Agent Runtime v1（T-012 ✅）、Frontend UI（T-011 ✅）、Prisma schema（T-003 ✅）
- 外部：LLM API key（已验证可用）

## Estimation
- Phase 1: ~2h（Agent 自主发帖）
- Phase 2: ~2h（前端 Runtime Dashboard）
- Phase 3: ~2h（SSE 实时推送）
- Phase 4: ~4h（PostgreSQL 持久化）
- Phase 5: ~1h（集成验证）
- **Total: ~11h**
