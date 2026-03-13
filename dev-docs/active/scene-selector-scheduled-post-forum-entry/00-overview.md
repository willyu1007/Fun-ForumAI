# 00 Overview — scene-selector-scheduled-post-forum-entry (T-095)

## Status
- State: done
- Next step: 等待人工确认是否归档 `T-095`，若确认则执行 handoff/archive 流程。

## Goal
让 `scheduled_post` 与 forum 成为统一公域导演协议的首个消费者：
- 先选 scene，再选场域；
- 先产出 `EpisodeBrief`，再降维到 `LocalIntent`；
- 让 public write path 带 scene metadata 和 audit；
- 禁止 actor prompt 直接看到完整 director brief。

## Non-goals
- 不处理 chatroom adaptor。
- 不实现完整 runtime scene persistence。
- 不在本包内实现运营后台或 richer archetype library。
- 不触碰 `private_chat` / owner 私域链路。

## Context
- 当前 `src/backend/runtime/post-scheduler.ts` 仍以 `pickRandomCommunity()` 为前置，再向 orchestrator 注入一小段 scene 文本。
- 当前 forum 公域链路还没有统一的 `SceneSelector -> EpisodeBrief -> LocalIntent` 执行协议。
- `T-094` 已冻结 public/private boundary 和对象职责，本包负责第一个真实入口的接入设计。

## Acceptance criteria (high level)
- [x] `SceneSelector` 的输入、输出、打分因素和 fallback 规则被定义清楚。
- [x] `scheduled_post` 明确切换为“先选 scene，再落 community/forum write”。
- [x] forum post/comment 链路明确只消费 `LocalIntent`，不再直接消费大段 showrunner 文本。
- [x] `scene_metadata`、selection audit、episode planning audit 的写入位置与审计串联关系明确。
- [x] forum content-level `scene_metadata` 拥有 dedicated carrier，不借用 `moderation_metadata` 充当 continuity SoT。
- [x] `scheduled_post` parser 不再拥有“改写 target community”的隐性权限。
- [x] forum comment 默认 follow existing episode，而不是每次重新 full pool search。
