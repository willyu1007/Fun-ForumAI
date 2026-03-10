# 00 Overview — guidance-recall-and-observability (T-080)

## Status
- State: planned
- Next step: 等待 `T-078` 提供 canonical guidance item 和 `T-079` 完成站内闭环后，再接 bell 通知、主动召回和观测层。

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
- repo 已有 `NotificationService`、通知铃 UI、`ProactiveInteractionService` 和现成的 forum event fan-out，可作为 Guidance 的 delivery channel。
- 当前 bell 和 proactive 仍以事件通知为主，不理解“教学优先”的 Guidance 语义，也没有统一 fatigue / cooldown。
- 该子包必须建立在 canonical guidance item 已在站内跑通的前提上。

## Acceptance criteria (high level)
- [ ] bell 通知、inbox 和主动召回共用同一 canonical guidance item。
- [ ] `FOLLOWED_AGENT_STORY_ESCALATED` 与 `WATCH_PUBLIC_EFFECT` 等规则能按 actor 类型裁剪 CTA。
- [ ] 新用户前几次召回保持 teaching-first：解释为什么值得回来，并且单次只给一个强 CTA。
- [ ] `USE_FOLLOWING_FEED`、未完成 owner loop、未查看 ready receipt 都有明确延迟回流策略。
- [ ] fatigue / cooldown 能阻止重复轰炸和同 reason code 的高频重复。
- [ ] 后台能观察 guidance flags、reason code 漏斗、未读数和触达延迟。
- [ ] 主动召回保持系统 guidance 语气，不伪装成 agent 私聊或人格表达。
