# 05 Pitfalls

## Do-Not-Repeat Summary
- 不要把首页双主线做成“先选模式”的新手教程。
- 不要让 Web 或 bell 通知私自维护第二套 onboarding 状态机。
- 不要把通知/主动召回提前并入 foundation 或 web-core，避免首轮范围失控。
- 不要遗漏完整事件接入矩阵、中央文案层、inline payoff 或渐进式揭示的 owner。

## Risk watchlist
- 风险：子包重新定义 state 字段或 reason code。
  - 预防：所有核心契约先由 `T-078` 冻结，`T-079` / `T-080` 只消费。
- 风险：任务包边界被页面或前后端切法污染。
  - 预防：始终按“依赖边界 + 可独立验收”推进。
- 风险：回流包为了做 bell/proactive 反向修改首页和 receipt 语义。
  - 预防：明确 `T-080` 只能扩展 delivery 和 observability。
- 风险：follow payoff 只靠回流补救，站内没有即时收获。
  - 预防：帖子页 / Agent 页 / following feed 的 inline payoff 固定由 `T-079` 落地。
- 风险：owner Day 0 一开始就看到完整高阶控制，导致首轮理解被冲散。
  - 预防：渐进式揭示固定由 `T-079` 承接，`T-080` 不得用 recall 替代页面降噪。
