# 05 Pitfalls — director-report-history-lifecycle-and-segmentation

## Known risks
- 如果 summary refresh 漏跑，默认报告会把“缺 summary”误判成“无 current 数据”。
- 如果 runtime archive 条件过宽，会误删 active-room 仍需读取的 scene state。
- 如果 archive 后没有给历史读路径补 fallback，旧房间消息投影会出现 program event 断链。

## Resolved pitfall
- symptom:
  - 默认报告把所有历史 `runtime_scene_states` 混进 `chatroom.runtime_sources`，导致修复后仍长期显示大量 `legacy_fallback`。
- root cause:
  - 旧 director report 直接按全历史聚合，没有区分“当前 active launch targets”与“历史保留样本”。
- what was tried:
  - 先尝试用“latest per room”做 current，但这仍会把不在 scene-pool launch 管理范围内的旧聊天室带进当前口径。
- fix/workaround:
  - current 口径改为“summary-backed latest per active launch target”，历史全集下沉到 `historical`。
  - archive / summary refresh / report 统一复用 director history 共享规则。
- prevention note:
  - 后续所有 scene-pool / director 验收报表都应先定义 target scope，再定义热窗口与 archive 规则；不要直接对全历史热表做默认 health summary。

## Resolved pitfall
- symptom:
  - 真实 chatroom smoke 中偶发 `Missing required prompt variables for agent-chat-reply@5: local_intent_block`，但 `ConversationClock` 只表现为普通运行时失败，根因被吞掉。
- root cause:
  - `ChatroomRuntimeContextBuilder` 和 `ChatroomLocalIntentService` 假定持久化 `runtime_scene_state.state_json.close_condition.objective_refs` 总是完整存在；旧/异常行缺字段时 builder 抛错，而 `ConversationClock` 把错误吃掉后继续走 prompt v5，最终把空 `local_intent_block` 送进 `PromptEngine`。
- fix/workaround:
  - 对 runtime state 的 `close_condition.objective_refs` 改成容错读取；
  - `ConversationClock` 增加最终 fallback local-intent block，即便 runtime context builder 失败也不会把 prompt v5 喂空变量；
  - 回归测试新增：
    - legacy runtime state 缺字段时 builder 仍能生成 `local_intent_block`
    - runtime context builder 失败时 `ConversationClock` 仍能成功走 `agent-chat-reply@5`
- prevention note:
  - 对来自 DB 的 scene/runtime JSON 一律按“不可信输入”处理；prompt-required carrier 不得依赖单一路径成功。

## Operational note
- symptom:
  - 一次性脚本直接 `new PrismaClient()` 会在本仓库失败，容易误判成 migration 或 repo 代码回归。
- root cause:
  - 当前仓库使用 Prisma 7 adapter-backed client；脱离 adapter 的临时脚本不会拿到正确初始化路径。
- fix/workaround:
  - 本轮所有 DB 写入与验证脚本统一复用 `loadLocalEnv()` + `createPrismaSession()`。
- prevention note:
  - 后续临时 DB 验证脚本不要直接手写裸 Prisma client，统一复用仓库已有 session helper。

## Resolved pitfall
- symptom:
  - `room_program_events` archive 在 schema 层看起来可行，但真实库里这批行仍可能被 `room_selection_ledgers` / `room_messages` 引用；一旦直接删除热表事件，就会在真实数据上炸外键或破坏历史引用链。
- root cause:
  - 初版 archive 逻辑只按 `created_at < cutoff` 选事件，没有把引用关系纳入资格判定。
- fix/workaround:
  - `room_program_events` 现在只归档“超过热窗且没有 ledger/message 引用”的事件。
  - 真实 dry-run fixture `t101-blocked-rpe-1` 已验证：被 ledger 引用的旧事件不会被计入 archive eligibility。
- prevention note:
  - 任何热表归档都必须先盘清剩余热表中的外键/软引用，再决定是“过滤候选”、“同步迁移依赖表”还是“改关系模型”；不能只看单表年龄条件。

## Resolved pitfall
- symptom:
  - current report 在某个 surface 没有 active launch target 时，会把全量 summary 行当成 current，导致“无 target 环境”也可能假绿。
- root cause:
  - summary/raw current 查询只有在 target 列表非空时才追加过滤；空列表被误当成“不过滤”。
- fix/workaround:
  - forum/chatroom 的 current 查询现在在 `launch target = 0` 时直接返回空集。
  - 真实验证显示 empty launch catalog 下 `forum.total=0`、`chatroom.total=0`。
- prevention note:
  - 报表里的 scope 为空时，语义应是“当前样本数为 0”，不是“退化成查全表”。

## Resolved pitfall
- symptom:
  - default summary report 的 `aftershow_statuses` 为空，而 `--use-raw` 有数据，summary/raw 口径不一致。
- root cause:
  - `DirectorHistoricalDailySummary` 没有 `aftershow_status` 维度，但 summary 读取代码却假定这个字段存在。
- fix/workaround:
  - 新增 migration `20260314212129_t101_historical_summary_aftershow_status`，并把 historical summary 的 SQL 聚合、存储和读取全链路补齐。
  - 真实对账结果：summary/raw 都得到 `due=9 / not_applicable=33`。
- prevention note:
  - 任何 summary-first 报表都要先做“summary schema vs raw output”维度对齐检查，不能默认读取层和存储层天然一致。
