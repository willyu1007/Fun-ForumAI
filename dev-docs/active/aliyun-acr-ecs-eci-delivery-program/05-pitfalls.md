# 05 Pitfalls (do not repeat)

## Do-not-repeat summary (keep current)

- 不要在总任务里直接写实现步骤细节，把实施细节下沉到子任务，避免父任务和子任务双写。
- 不要把 ACK 混回本轮文档范围，否则目标链路会再次漂移。
- 不要让 `T-129` 触发部署，镜像发布和运行时消费必须分开。
- 不要把“镜像回滚”表述成“数据库回滚”，Prisma migration 前提必须单独写清。

## Pitfall log (append-only)

### 2026-03-28 - Task bootstrap
- Symptom:
  - 交付链讨论容易在 ACR、ECS、ECI、ACK 几条路径之间来回切换，导致任务边界模糊。
- What we tried:
  - 先冻结平台范围与宿主机形态，再拆成一个总任务和三个完整子任务。
- Fix / workaround:
  - 用 `T-128` 承载全链路目标，用 `T-129` 到 `T-131` 承载执行边界。
- Prevention:
  - 后续实现阶段若要扩大到 ACK 或多区域，必须新增任务而不是回写本任务边界。

### 2026-03-28 - Coverage review
- Symptom:
  - 任务包已经覆盖 ACR、ECS、ECI 三条执行线，但仍容易遗漏“谁来触发部署”“多 ECS 的 SSE 前提”“DB 回滚前提”这三类跨任务约束。
- What we tried:
  - 对照运行时配置、SSE 配置和 README 中的 `pnpm db:migrate:deploy` 重新审视任务边界。
- Fix / workaround:
  - 在 `T-128/T-130/T-131` 中显式冻结第一阶段人工部署控制面、prod 多 ECS 必须使用 Redis SSE 广播、以及 migration 向后兼容/显式 DB 回退方案。
- Prevention:
  - 以后凡是写“回滚”或“prod 多实例”时，必须同时检查 DB 兼容性与 SSE 跨实例前提是否已经落到文档。
