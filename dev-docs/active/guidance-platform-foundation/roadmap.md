# Roadmap — guidance-platform-foundation (T-078)

## Goal
- 建立 Guidance 的服务端单一事实源：actor resolver、state/inbox/event log、reason rule 骨架、API skeleton、SSE 事件与 hook 接线，为后续 Web 与召回子包提供稳定契约。

## Scope
- Prisma schema / repo / service skeleton
- Guidance API skeleton
- 完整 Guidance 事件接入矩阵
- 中央文案层与 CTA/copy contract
- Event hook / digest hook 接线
- `source_session_id` memories filter
- Feature flags / metrics skeleton

## Non-goals
- 不做首页 UI、inbox 页面或 private receipt UI。
- 不做 bell 通知与主动召回策略。
- 不在本包内引入新的 LLM 逻辑或 prompt 决策。

## Milestones
1. 冻结 state/stage/track/reason code 与 `summary.modules[]` 契约
2. 落 guidance schema / repo / backend module skeleton
3. 打通 read/control/private-channel/client event / SSE / hook wiring / `source_session_id`
4. 完成空态、去重、merge、track inference 验证

## Rollback
- 通过 Guidance feature flags 短路新链路，保留现有 read/control/private-channel 行为。
