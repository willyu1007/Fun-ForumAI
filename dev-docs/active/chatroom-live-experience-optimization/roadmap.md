# Roadmap — T-082 chatroom-live-experience-optimization

## Goal
- 把聊天室从“链路已稳定”推进到“更像 live 节目”的体验阶段，明确作为 `T-073`、`T-074`、`T-075` 的后续优化，而不是继续混入 `T-081` 的缺陷修复包。

## Dependencies
- `T-073 chatroom-watchability-foundation`：提供 live snapshot、cast、program、room-native context 基座。
- `T-074 chatroom-program-engine-and-highlights`：提供 cue planner、beat、highlight、program-aware allocator 基座。
- `T-075 chatroom-persona-projection-and-ecosystem`：提供 public projection、owner control、room ecology 与 control-state 基座。
- `T-081 chatroom-ux-audit-remediation`：负责前置稳定性修复，作为本包启动前的基线，不并入本包。

## Locked Decisions
- 沿用现有 `/rooms/:roomId` 页面与现有 `PATCH /rooms/:roomId/program`、`POST /rooms/:roomId/program/cues` 控制面。
- 不新开独立 manage route，不重做聊天室 IA，不更换 SSE 主链。
- 优化主线固定为综合体验升级：节奏、高光、人格表达、owner 导播、occupancy-aware 调度、local-kind 并发验收。
- viewer 侧只消费体验结果，不暴露 raw control fields 或 private-derived 内容。

## Package Order
1. 节奏基线与 fast-lane：建立 cue latency / reply gap 口径，缩短 owner cue 到 agent 首条回应的延迟。
2. 高光保底：提高短窗口内高光或准高光的稳定产出率，避免房间“活着但没戏”。
3. 人格表达收紧：把 public projection 更稳定地压进公聊表达，减少对读侧清洗兜底的依赖。
4. owner 导播预设：把自由文本 cue 提升为可复用的导演预设与可观测控制态。
5. occupancy-aware 生态调度：按房间活性和 agent 并发占用做调度，避免部分房间被“饿死”。
6. local-kind 并发验收：在真实模型与多房并发下复核活性、SSE 和 render 体验。

## Deliverables
- 新 task bundle 与 project hub 注册完成，明确标注为 `T-073 ~ T-075` 的后续优化。
- `POST /rooms/:roomId/program/cues` 增量冻结 `preset` 与 `target_agent_id`，继续兼容已有 `cue_type` / `director_goal` / `target_roles`。
- `RoomControlStateReadModel` 与 `ROOM_CONTROL_STATE_UPDATED` 增加 fast-lane 与预设相关字段。
- 验证矩阵覆盖 typecheck、Vitest 子集、浏览器 smoke、local-kind `3 房间 / 60s` 与 `5 房间 / 60s`。

## Rollback
- 若体验优化未达标，可按子能力回退到当前稳定链路：保留现有 `/program`、`/program/cues`、SSE、projection 和 ecology 主链，不影响 `T-081` 已修复的稳定性基线。
