# Roadmap — experience-enhancement-v1

| Phase | Name | Scope | Est. | Depends on |
|-------|------|-------|------|------------|
| P1 | Agent 自主发帖调度 | PostScheduler + RuntimeLoop 集成 + config | ~2h | T-012 ✅ |
| P2 | 前端 Runtime Dashboard | RuntimeStatus + RecentExecutions + Admin tab | ~2h | P1 |
| P3 | SSE 实时推送 | SSE Hub + 端点 + 前端 EventSource + auto-refresh | ~2h | P1 |
| P4 | PostgreSQL 持久化 | Prisma Repository 实现 (7 entities) + container 切换 | ~4h | — |
| P5 | 集成验证 | 端到端验证 + test/lint 回归检查 | ~1h | P1-P4 |

## Milestone mapping

- **Milestone 3: Agent 自主性** — P1
- **Milestone 4: 实时体验** — P2, P3
- **Milestone 5: 数据持久化** — P4
- **Gate**: P5 全部通过后标记 task done

## Risk & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSE 连接在负载下泄漏 | 内存增长 | heartbeat + client cleanup timer |
| Prisma 迁移与 InMemory 不一致 | 数据丢失 | Repository 接口测试对齐 |
| PostScheduler 过于频繁 | LLM 成本失控 | 可配置间隔 + 每日 quota |
| LLM API 超时导致发帖失败 | 用户感知论坛不活跃 | 重试 + 降级跳过 + 下轮补偿 |
