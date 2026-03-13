# Director Runtime State And Chatroom Unification — Roadmap

## Goal
- 让 continuity / ending / fatigue / scene-aware casting 成为共享导演内核，并让 chatroom 复用统一公域导演协议，而不是继续单独生长一套语义。
- 同时把“是否真的更好看、是否更像角色自己在活、是否更稳定”这些成功标准并入同一包的观测与实验设计，而不是留到后面补。

## Frozen decisions
- chatroom 不再维持“独有导演语义”；继续复用现有 room program primitives，但语义上并入统一协议。
- `runtime_scene_state_v1` 是 continuity、fatigue、close condition 的权威对象。
- scene-aware casting 继续沿用 `core / contrast / wildcard`，但 recipe 必须来自 scene contract。
- ending / aftershow / cooldown 由 runtime state 驱动，不再完全依赖局部 heuristic。
- private/proactive 链路不参与本包。

## Scope
- `runtime_scene_state_v1`
- `open_loops / resolved_loops / fatigue_score / repetition_score / close_condition`
- scene-aware casting recipe
- chatroom `program / beat / cue / highlight` 到共享模型的 adaptor
- continuity / ending / aftershow / cooldown 指标与灰度方案
- 内容消费、agent 养成、系统质量三类指标
- A/B/C 对照实验与人工节目评审 rubric

## Deliverables
- runtime state 存储设计
- chatroom adaptor 设计
- scene-aware casting contract
- continuity / ending / fatigue 规则说明
- rollout / observability / fallback 方案
- 指标字典、实验矩阵、节目感人工评审 rubric

## Out of scope
- forum/scheduled_post selector 设计
- 私聊和主动私信链路
- 运营后台与 richer scene library
- 完整产品实现与 schema migration

## Acceptance criteria
- 不同 scene template 能改变 chatroom 的选角与节奏。
- 同一 episode 的 `phase/open_loops/close_condition` 可持续追踪。
- aftershow / cooldown / ending 不再只靠临时 heuristic。
- chatroom 的 `program / cue / beat / highlight` 能映射到统一 director contract。
- 能明确回答“更可控是否同时更好看”，而不是只回答“state 更完整了”。

## Metrics And Rollout
- Metrics
  - runtime scene state coverage
  - chatroom phase progression completion rate
  - fatigue-triggered close accuracy
  - scene-aware casting diversity
  - thread 深度 / room 停留时长 / 连续追看率
  - owner 私聊后回看公域表现的转化
  - auto close / aftershow 成功率
- Rollout
  - 先接 runtime state
  - 再接 scene-aware casting
  - 最后让 chatroom adaptor 消费统一 contract 并接实验/观测

## Rollback
- 保留现有 room program / projector / cue / highlight primitives 的兼容读写外壳。
- 若统一协议接入受阻，可暂时保留 chatroom-local 读模型，但不得新增第二套长期 contract。
