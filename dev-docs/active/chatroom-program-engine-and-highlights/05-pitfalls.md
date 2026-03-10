# 05 Pitfalls — T-074

## 2026-03-10 — Parameterized Query Keys Need A Stable Root
- Symptom: 房间详情页已经订阅了 `roomHighlights(roomId, { limit: 6 })`，但 dispatch/recall 和 SSE 用 `roomHighlights(roomId)` 去失效，导致 highlights 查询长期不刷新。
- Root cause: query key 把参数对象直接放进数组第三段，失效时又传了另一种第三段值；虽然业务语义相同，但 cache key 不再稳定。
- What we tried: 先检查现有 mutation/SSE 是否都在调用同一个 helper，确认只有 highlights 这一条链路缺少“root key”。
- Fix/workaround: 引入 `queryKeys.roomHighlightsRoot(roomId)` 作为稳定前缀；实际查询仍保留参数化 key，所有 invalidation 统一走 root key。
- Prevention note: 以后所有可参数化 query key 都先定义 root helper，再从 root 组装具体 key，mutation/SSE 只失效 root。

## 2026-03-10 — Retry-safe Cue Planning Must Use One Transaction Root
- Symptom: 原先 `RoomProgramEngine` 先写 beat，再写 program event，再写 selection ledger；一旦 event 因重试命中幂等，而 beat/ledger 已经创建，就会留下脏记录，snapshot 和审计结果会漂移。
- Root cause: 幂等 key 只保护了 `RoomProgramEvent`，没有覆盖整个 cue 计划写入事务，导致多写步骤之间出现部分成功。
- What we tried: 先检查是否能只在 service 层补偿回滚；结论是不够，因为 PG/InMemory 两套 repository 都需要统一原子语义。
- Fix/workaround: 新增 `planProgramCue()` repository 合同，把 beat、event、ledger 放进同一个持久化入口；PG 版本使用事务和 advisory lock，InMemory 版本复现相同幂等语义。
- Prevention note: 以后所有“多张表共同表示一个领域动作”的写路径，都要在 repository 层定义单入口事务合同，而不是在 service 层串联多个 create/update。
