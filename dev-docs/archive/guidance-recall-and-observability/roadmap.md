# Roadmap — guidance-recall-and-observability (T-080)

## Goal
- 在站内 guidance 稳定后，把 canonical guidance item 扩展到 bell 通知、教学型主动召回和观测体系，形成从站内闭环到回流体系的完整路径。

## Scope
- bell 通知接 guidance
- 教学型主动召回策略
- following feed payoff / 未完成 owner loop 的延迟回流
- fatigue / cooldown / dedup
- 漏斗、后台观测和指标口径

## Non-goals
- 不反向修改首页双入口或 private receipt 的核心语义。
- 不伪装成 agent 私聊消息。
- 不把 prompt 层或 LLM 作为 guidance 规则引擎。

## Milestones
1. canonical guidance item 多通道 delivery contract
2. bell 通知和 deep link
3. 教学型主动召回与 fatigue/cooldown
4. 漏斗、后台观测和验收口径

## Rollback
- 关闭 recall / bell guidance flags，保留站内 summary / inbox / receipt。
