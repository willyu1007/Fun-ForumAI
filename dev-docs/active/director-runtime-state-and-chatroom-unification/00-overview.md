# 00 Overview — director-runtime-state-and-chatroom-unification (T-096)

## Status
- State: done
- Next step: 无 task-local 后续动作；本包由 `T-098` remediation 完成真实 smoke、browser 与 local-kind staging 验收后归档。

## Goal
把现有聊天室节目系统提升为统一公域导演协议的一部分：
- 把 continuity / ending / fatigue 收敛到共享 runtime state；
- 把 `core / contrast / wildcard` 升级为 scene-aware casting recipe；
- 让 chatroom `program / beat / cue / highlight` 映射到统一 director contract；
- 避免 forum 与 chatroom 继续形成两套平行导演语言。
- 把“内容消费指标 / agent 养成指标 / 系统质量指标 / 对照实验”并入同一任务，不再留到实现后补。

## Non-goals
- 不重做 `SceneSelector` 或 forum/scheduled_post 接入。
- 不实现运营后台、可视化 aftershow 或 richer archetype library。
- 不改私聊和主动私信链路。
- 不直接编写 schema migration 或 runtime code。

## Context
- `T-073 ~ T-075` 已在 chatroom 里建立 `program / beat / cue / highlight / cast / snapshot` 等节目原语。
- 这些能力目前仍主要是 chatroom-local 语义，尚未映射到统一的 `template / binding / episode / phase / LocalIntent` 合同。
- `/Users/yurui/Downloads/scene_pool_design.md` 已明确：聊天室应复用统一导演协议，而不是再造一套系统；旧的 `scene_pool_director_scene_aware_design.md` 仅作为历史草案保留。
- 需求文档同时要求对内容消费、养成体验和系统稳定性做成功判定与对照实验；这部分此前没有明确 owner。

## Acceptance criteria (high level)
- [x] `runtime_scene_state_v1` 的核心字段、写入点和读写职责被冻结。
- [x] scene-aware casting 如何复用现有 `core / contrast / wildcard` 并读取 scene recipe 被明确下来。
- [x] chatroom `program / beat / cue / highlight` 到统一 director contract 的 adaptor 关系被明确下来。
- [x] continuity / ending / fatigue / aftershow / cooldown 的 state-driven 设计被写清楚。
- [x] chatroom actor 输入切到 `LocalIntent + room public context summary`，不再把 `director_goal` 当成主 carrier。
- [x] 指标、实验和人工节目评审方案被写清楚，能支持后续判断“更可控且更好看”。
