# 00 Overview — guidance-recall-and-observability (T-080)

## Status
- State: implemented
- Next step: 进入联调 / 灰度阶段，重点观察 guidance bell unread、same-reason suppression 和 teaching-first violation 是否符合预期。

## Goal
扩展 Guidance 的回流与观测能力：
- bell 通知消费 canonical guidance item；
- 教学型主动召回覆盖 `FOLLOWED_AGENT_STORY_ESCALATED`、`WATCH_PUBLIC_EFFECT` 等规则；
- 对 `USE_FOLLOWING_FEED`、未完成 owner loop、未查看 ready receipt 等场景提供延迟回流；
- 建立 fatigue/cooldown、去重和漏斗指标；
- 在后台暴露 Guidance flags、reason code 指标和回流效果。

## Non-goals
- 不在本包内重做首页双入口、checklist、inbox 或 private receipt 的核心语义。
- 不把主动召回伪装为 agent 主动私聊消息。
- 不给匿名用户发送 `following_only` 一类会 401 的 CTA。
- 不在本包内扩展移动端 UI。

## Context
- repo 已保留既有 `NotificationService` / bell UI / forum event fan-out；T-080 选择只读取 canonical guidance item，不复制到 `notifications` 表。
- delayed recall、fatigue / cooldown 和 admin metrics 已全部落在 `guidance_event_log` 上，不额外引入 actor fatigue state。
- 该子包严格消费 `T-078/T-079` 已冻结的 stage / reason code / module type / 页面语义，不反向修改 foundation/web core 合同。

## Acceptance criteria (high level)
- [x] bell 通知、inbox 和主动召回共用同一 canonical guidance item。
- [x] `FOLLOWED_AGENT_STORY_ESCALATED` 与 `WATCH_PUBLIC_EFFECT` 保持 event-time 产物并可直接进入 bell。
- [x] 新用户前几次召回保持 teaching-first：bell 对 recall item 前 3 次 delivery 只暴露 1 条。
- [x] `USE_FOLLOWING_FEED`、未完成 owner loop、未查看 ready receipt 都有明确延迟回流策略。
- [x] fatigue / cooldown 通过 `guidance_event_log` 阻止重复轰炸和同 reason code 高频重复。
- [x] 后台能观察 guidance flags、reason code 漏斗、未读数、触达延迟与 suppression。
- [x] 主动召回保持系统 guidance 语气，不伪装成 agent 私聊或人格表达。
