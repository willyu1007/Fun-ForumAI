# 00 Overview — guidance-web-core-experience (T-079)

## Status
- State: planned
- Next step: 等待 `T-078` 冻结 `summary.modules[]`、reason code、guidance action contract 后，开始首页、inbox 和 private receipt 的 Web 接入。

## Goal
落地 Guidance 的 Web 首发核心体验：
- 首页以“无感双入口”明确讲清看戏 / 养成两条主线；
- 首页和 inbox 都消费同一套 guidance item；
- 私聊页承载 pending -> ready 的 nurture receipt；
- 帖子页、Agent 页、memories / chronicle / achievements 页提供 inline payoff 与因果解释；
- Day 0 对 owner 高级控制面做降噪与渐进式揭示；
- 所有站内动作都通过统一 action 上报和 SSE 更新保持状态一致。

## Non-goals
- 不做 bell 通知、教学型主动召回或后台观测。
- 不在本包内新增或修改 foundation 冻结的 state / reason / module 协议。
- 不把首页做成“先选模式”的教程或向导。
- 不做移动端 UI 适配。

## Context
- 当前 Web 首页默认是 `FeedPage`，缺少对产品双主线的第一眼表达。
- 顶层布局已有 `NotificationBell`、`AgentPanel` 和 `OnboardingBar`，但它们只能承载局部提示，不能表达系统化 guidance。
- PrivateChatPage 当前只在 session end 后显示“记忆摘要正在生成中...”，没有 pending/ready receipt 统一卡片模型。

## Acceptance criteria (high level)
- [ ] 首页不要求用户选模式，但能明确传达“看戏 / 养成”两条主线。
- [ ] 首页 CTA、inbox item、private receipt 共用同一 guidance contract，不出现第二套前端状态机。
- [ ] 帖子页和 Agent 页能承接 follow / highlights / 创建 / 私聊等即时 payoff，不把 spectator loop 只留给首页。
- [ ] memories / chronicle / achievements 页能解释“为什么你会在这里看到这些内容”，而不是只做数据展示。
- [ ] 用户结束私聊后能先看到 pending receipt，digest 完成后同一卡片升级为 ready。
- [ ] Day 0 时 style / instructions / advanced 等 owner 高级能力被延后或降权显示，完成 first success 后再渐进揭示。
- [ ] inbox、首页、私聊页的 shown/clicked/dismissed/completed 动作状态一致。
- [ ] 匿名首访与登录后续用都能延续 guidance 体验，不会重新被当作 Day 0 用户。
