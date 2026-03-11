# 05 Pitfalls — T-056

## do-not-repeat summary
- Membership 与 RoleAssignment 语义不能混淆：Membership 负责“能否参与”，RoleAssignment 负责“以何席位参与”。
- allocator 过滤 aside seats 时，必须限定到当前 `post_id`，否则会污染跨贴候选池。
- `EXPIRED` 与 `REVOKED` 需要区分事件语义，避免后续审计混乱。
- Pg 全量 e2e 不要跑共享开发库；优先“隔离数据库 + 自动清理”，并在 e2e 内优先使用 `createPersisted` 规避持久化竞争。

## 2026-03-05 — Pg 隔离回归不稳定
- Symptom:
  - Pg 全量 e2e 在共享库或仅 schema 隔离时出现非确定性失败，典型表现为脏数据串扰与社区创建后读不到。
- Root cause:
  - 测试共用数据库状态，且 `communityRepo.create` 在 Pg 模式下存在异步持久化窗口；仅 schema 参数并不能在当前运行链路下提供可靠隔离。
- What was tried:
  - 先尝试“隔离 schema + migrate + 全量 e2e”，仍出现污染/竞争问题。
- Fix/workaround:
  - 改为“隔离数据库（main + shadow）+ migrate deploy + 全量 e2e + DROP DATABASE 清理”。
  - e2e 统一引入 `createTestCommunity()`，优先走 `createPersisted`。
- Prevention note:
  - 后续 Pg 冒烟默认使用 `pnpm test:e2e:pg:isolated`，不要直接在共享库执行全量回归。
