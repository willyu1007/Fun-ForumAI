# 03 Implementation Notes

## Current status
- 状态：implemented
- 说明：backend recall scheduler、bell read model、admin runtime guidance metrics，以及 frontend bell/runtime 面板已完成并通过定向验证。

## Ready checklist
- [x] canonical guidance item 已稳定
- [x] bell 通知与 proactive 入口边界已确认
- [x] fatigue / cooldown 指标定义已冻结
- [x] admin 观测展示面已选定
- [x] teaching-first 前 3 次 recall 的口径已冻结
- [x] `USE_FOLLOWING_FEED` / owner loop / ready receipt 的延迟回流触发条件已冻结

## Implemented scope
- backend 新增 `GuidanceBellService`、`GuidanceRecallScheduler`、`GuidanceObservabilityService`，并在 container / app / server 生命周期中完成 wiring。
- `GET /v1/guidance/bell` 只返回 bell 可展示的 canonical guidance item；`WATCH_PUBLIC_EFFECT` / `FOLLOWED_AGENT_STORY_ESCALATED` 通过 event-time upsert + bell delivery log 立即进入 bell。
- delayed recall 规则落地：
  - `USE_FOLLOWING_FEED`：首次 follow 2h 后仍未进入 following feed。
  - `START_FIRST_PRIVATE_CHAT`：创建 agent 6h 后仍未开始私聊。
  - `NURTURE_RECEIPT_READY`：digest ready 2h 后仍未查看完成时 re-arm 同 dedup item。
- fatigue / cooldown 全部基于 `guidance_event_log`：
  - 同 actor + same reason 24h 最多 1 次 delivery。
  - 同 actor 任意 recall 24h 最多 3 次 delivery。
  - dismiss 后同 reason 冷却 24h。
  - recall 前 3 次 delivery bell 只暴露 1 条 recall item。
- orchestrator completion 语义已收紧：
  - `MEMORIES_VIEWED` 命中 `source_session_id` 时，将 `NURTURE_RECEIPT_READY` 置为 `COMPLETED`。
  - manual / automatic dismiss 和 complete 都会写入 lifecycle event log。
- admin runtime `/v1/admin/runtime/features` 已新增 guidance block：
  - flags
  - bell unread / active
  - per-reason delivered / opened / dismissed / completed
  - avg delivery delay
  - same-reason suppression / 24h cap suppression
  - teaching-first violation count
- frontend:
  - `Layout.tsx` bell dropdown 在 legacy notifications 上方新增 `Guidance` 分区，并使用 guidance unread + notifications unread 组合 badge。
  - `RuntimeDashboard.tsx` 新增 Guidance Runtime 卡片展示 observability 指标。
  - `VITE_FF_GUIDANCE_BELL_V1` 和 `FF_GUIDANCE_RECALL_V1` 已进入 env contract，并刷新生成物。

## Handoff notes
- 若站内 receipt / inbox 仍不稳定，不要提前接主动召回。
- 任何 recall 文案都必须解释“为什么现在值得回来”，而不是纯催促。
- recall 负责补全延迟回流，不负责替代 post / agent / following feed 的站内 payoff surface。
- 当前实现没有接入 email / push / mobile；若后续扩展跨端提醒，仍应继续消费 canonical guidance item，而不是复制到另一张通知卡表。
