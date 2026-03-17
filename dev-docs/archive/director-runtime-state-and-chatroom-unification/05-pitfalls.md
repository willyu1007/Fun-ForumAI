# 05 Pitfalls — T-096

## Do-not-repeat summary
- 不要让 chatroom 再单独发明一套长期导演 contract。
- 不要把 `RoomLiveSnapshot` 当成 continuity / ending / fatigue 的权威状态。
- 不要在 scene-aware casting 中绕开现有 `core / contrast / wildcard` 和 guard 体系。

## Historical log
- 2026-03-13
  - symptom: `RoomLiveSnapshot`、`RoomEpisode`、`RoomProgramEvent` 都带一部分 episode 信息，最容易让实现侧误以为“现有对象拼起来就等于 runtime authority”。
  - root cause: chatroom 子系统已经积累了足够多的节目对象，但这些对象分别服务 read model、节目审计和 watchability 摘要，没有唯一写权。
  - what was tried: 对照 `room-program-engine`、`room-projector`、`room-watchability-repository` 检查 phase/ending/fatigue 相关字段；结论是现有对象无法单独承担 shared runtime authority。
  - fix/workaround: 在合同中新增 `RuntimeSceneStateManager + runtime_scene_state_v1`，并把现有房间对象全部降级为 adaptor/read model/evidence。
  - prevention note: 后续只要出现“某个 room-local object 也能改 phase/close_condition”的设计，应直接视为 double-authority 风险。
- 2026-03-13
  - symptom: 很容易为了“先跑起来”把 `runtime_scene_state_v1` 做成 chatroom sidecar，再说以后迁成 shared authority。
  - root cause: sidecar 在短期看起来改动小，但会把 chatroom-local 语义固化进存储层，后续 forum 复用时二次返工。
  - what was tried: 对照当前 `RoomEpisode / RoomLiveSnapshot / RoomProgramEvent` 的职责，评估 sidecar 是否真的能充当 shared authority；结论是否定的。
  - fix/workaround: 本包已冻结 dedicated state table 方案，并拒绝 authority sidecar 备选。
  - prevention note: 任何新的 runtime state 存储如果依附在 room-local 对象上，都要先被视为架构回退。
- 2026-03-13
  - symptom: chatroom prompt 当前仍直接消费 `director_goal`、`program_scene`、`cue_type` 等 free-text/legacy director 变量，容易重新走向厚 showrunner。
  - root cause: `ChatroomRuntimeContextBuilder` 和 `ConversationClock` 的现有链路是围绕 program cue prompt 设计的，还没有接入 `LocalIntent`。
  - what was tried: 对照 forum 在 `T-095` 的降维规则，确认 chatroom 也必须改走 `EpisodeBrief -> LocalIntent`，否则统一导演协议会在 room 侧破功。
  - fix/workaround: 在本包合同中把 `director_goal` 降级为 compatibility 字段，规定 actor prompt 只看 `LocalIntent + room public context summary`。
  - prevention note: 后续只要 chatroom 继续把 raw `director_goal` 当 actor 主输入，就不算完成 `T-096`。
- 2026-03-13
  - symptom: 从 `director_goal` 迁到 `LocalIntent` 时，最容易出现“先双轨跑着再说”，最后两套语义长期漂移。
  - root cause: big bang 风险高，团队自然会倾向保留 compat 字段，但若没有明确截止条件，就会长期并存。
  - what was tried: 对照当前 prompt 变量链路评估 big bang / staged cutover / 长期双轨，结论是 staged cutover 最稳，但必须显式禁止长期双轨。
  - fix/workaround: 合同中已锁定 staged cutover，并把 `director_goal_compat` 限定为过渡字段。
  - prevention note: 如果某个 rollout 计划没有包含 compat 字段下线条件，就不算合格迁移方案。
- 2026-03-13
  - symptom: 另一种常见遗漏是把 feature flag 写进架构文档，但不落到 `config.ts` 和 env contract，结果 rollout 只能靠临时约定。
  - root cause: 规划阶段容易把灰度当成“实现时再补”的杂务，但这个仓库的 feature flag 已经是正式治理机制。
  - what was tried: 对照 `config.features.*` 与现有 repo/service 命名模式，确认 `FF_DIRECTOR_RUNTIME_STATE_V1` 和 `FF_CHATROOM_LOCAL_INTENT_V1` 应作为正式配置 contract 落库。
  - fix/workaround: handoff 中已经把 config/env contract 更新列为必须项，并拆成 authority flag 与 prompt cutover flag 两个独立开关。
  - prevention note: 任何 rollout 如果没有明确的 config key、默认值和启用顺序，都不应进入实现阶段。
