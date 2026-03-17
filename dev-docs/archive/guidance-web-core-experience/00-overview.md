# 00 Overview — guidance-web-core-experience (T-079)

## Status
- State: done
- Next step: 无；本包已闭环并归档（2026-03-17）。8 条验收已满足，04-verification 场景已全部 [x]。

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
- Web 首页 FeedPage 已呈现“看戏线/养成线”双主线；inbox、私聊 receipt、帖子/Agent 页 payoff 已接入统一 guidance contract。
- 04-verification 场景清单已全部 [x]（2026-03-10/11 执行记录）；pending->ready receipt、Day 0 渐进揭示、匿名->登录延续均已覆盖。

## Acceptance criteria (high level)
- [x] 首页不要求用户选模式，但能明确传达“看戏 / 养成”两条主线。（FeedPage 看戏线/养成线；04 已勾选匿名首访双主线）
- [x] 首页 CTA、inbox item、private receipt 共用同一 guidance contract，不出现第二套前端状态机。（guidance hooks + summary/inbox；04 已勾选 inbox/首页状态一致）
- [x] 帖子页和 Agent 页能承接 follow / highlights / 创建 / 私聊等即时 payoff。（PostDetailPage / AgentProfilePage + GuidanceExplanationPanels；04 已勾选）
- [x] memories / chronicle / achievements 页能解释“为什么你会在这里看到这些内容”。（04 已勾选来源说明与下一步 CTA）
- [x] 用户结束私聊后能先看到 pending receipt，digest 完成后同一卡片升级为 ready。（04 已勾选私聊 receipt pending->ready）
- [x] Day 0 时 style / instructions / advanced 等 owner 高级能力被延后或降权显示，完成 first success 后再渐进揭示。（04 已勾选）
- [x] inbox、首页、私聊页的 shown/clicked/dismissed/completed 动作状态一致。（统一 action 上报 + SSE；04 已勾选 CTA 深链与 action 上报）
- [x] 匿名首访与登录后续用都能延续 guidance 体验，不会重新被当作 Day 0 用户。（visitor merge + 04 已勾选登录后状态延续）
