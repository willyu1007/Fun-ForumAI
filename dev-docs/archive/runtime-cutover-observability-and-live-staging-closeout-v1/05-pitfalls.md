# 05 Pitfalls

## Do-not-repeat

- 不要在 `T-901` 的 execution-plan contract 未稳定前，把 `T-936` 变成一次性大迁移任务。
- 不要把 staging live gate 建立在本地临时 key 或本地 mock infra 之上。
- 不要把 closeout fixture 的“session stale”误当成“最后一条消息 stale”；worker timeout 看的是 message timeline，不是只看 session.started_at。
- 不要在 proactive opening 重构里把 policy target 和 notification target 合并成同一个字段；这会悄悄改掉 moderation / attribution 语义。

## Pitfall log

### 2026-04-04 - Hidden worker fixture stale window
- Symptom:
  - closeout fixture 在 `message_count` 较高时可能永远不被 `PrivateChannelScheduler` 消费，脚本会一直等不到 hidden/identity 证据。
- Root cause:
  - 最初只按 `PRIVATE_SESSION_TIMEOUT_MS + 5m` 计算 stale window，没有把 fixture messages 按 1 分钟间隔回填的事实算进去，导致最后一条消息仍落在 timeout 窗口内。
- What we tried:
  - 复核 `findTimedOutSessions()` 的 SQL 条件，确认 timeout 以“最近一条 message.created_at 是否仍晚于 threshold”为准，而不是只看 session.started_at。
- Fix / workaround:
  - admin closeout fixture 现在按 `timeoutMinutes + messageCount + 5` 计算最小 stale minutes，并新增 dense fixture 回归测试。
- Prevention:
  - 以后凡是构造 scheduler/backfill fixture，都必须按真实消费条件倒推出安全时间窗，而不是只按入口对象的顶层时间戳拍脑袋设置。

### 2026-04-04 - Proactive opening policy attribution drift
- Symptom:
  - 抽取 proactive opening 公共 helper 时，很容易把 policy evaluate 的 `target_id` 和通知落点复用成同一个字段。
- Root cause:
  - vote / opinion challenged 的 policy 语义依赖真实触发对象（post/thread/turn），而通知呈现的 target 则是 agent，本来就是两个不同维度。
- What we tried:
  - 把 create session / create message / persona observability / notification 逻辑收进统一 helper，并重新对照原实现逐项核对。
- Fix / workaround:
  - helper 里显式拆分 `policyTargetId` 与 `notificationTargetId`，closeout fallback 也保持同一 contract。
- Prevention:
  - 后续凡是抽共享 helper，都先标出“审核/归因目标”和“通知/UI 目标”是否为同一实体，不能默认复用。
