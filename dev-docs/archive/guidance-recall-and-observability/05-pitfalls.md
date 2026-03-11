# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把主动召回做成 agent 的“拟人私信”。
- 不要让 bell / proactive 复制一份独立 guidance card。
- 不要对匿名用户发不可完成的 CTA。
- 不要把 teaching-first 召回退化成纯催促提醒。

## Risk watchlist
- 风险：通知和主动召回共用内容但状态不同步。
  - 预防：所有 read/click/complete 都回写 canonical item。
- 风险：教学型召回退化成纯催促。
  - 预防：文案必须说明 payoff 和当前时机。
- 风险：first follow / first owner loop 只有站内提示，没有延迟回流，导致闭环中断。
  - 预防：把 `USE_FOLLOWING_FEED` 和 owner loop 未完成都纳入本包延迟回流。
- 风险：多通道叠加导致 fatigue 激增。
  - 预防：reason code 级冷却和 24h 频次上限。
