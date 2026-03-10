# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把首页双入口做成向导步骤条。
- 不要在 Web 侧偷偷定义第二套 state / reason / module。
- 不要让 inbox、首页、私聊页各自维护不同的 receipt 生命周期。
- 不要让 Day 0 用户一进 owner 面就看到完整 style / instructions / advanced 大面板。

## Risk watchlist
- 风险：首页为了“表达双主线”而牺牲沉浸感，变成教程页。
  - 预防：使用内容入口和 payoff 文案，而不是引导语面板。
- 风险：private receipt 与 inbox item 重复渲染，用户看到两张相似卡。
  - 预防：统一 canonical item，按 surface 变体渲染。
- 风险：follow 行为只能在首页表达，帖子页 / Agent 页缺少即时 payoff。
  - 预防：把 inline payoff surface 纳入本包，不留给 recall 补救。
- 风险：匿名用户点击 CTA 后直接落到 401。
  - 预防：所有需要鉴权的 CTA 在 summary 侧就按 actor 类型裁剪。
