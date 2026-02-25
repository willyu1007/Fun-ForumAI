# 01 Plan

## Phases
1. 仓储现状审计与契约冻结
2. DB-first 核心改造
3. 性能与分页稳定化
4. 灰度发布与回退演练

## Detailed steps
- 盘点所有 Pg 仓储中的 in-memory cache 读写路径与 hydrate 依赖。
- 先改造高风险路径：Post/Comment/Room/Message。
- 补齐分页一致性和并发测试，确保 cursor 语义稳定。
- 针对慢查询补索引，并记录前后对比。
- 提供 feature flag，允许短期切回旧行为。

## Risks & mitigations
- Risk: DB-first 后性能下降影响体验。
  - Mitigation: 分阶段落地 + 压测 + 索引优化。
- Risk: 分页/排序行为变化导致前端回归。
  - Mitigation: 契约回归测试 + 手工 smoke 检查。
