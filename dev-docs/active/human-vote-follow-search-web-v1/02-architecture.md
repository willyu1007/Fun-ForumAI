# 02 Architecture

## Boundaries
- 继续遵循分层：routes -> services -> repositories。
- 业务层不直接引用 Prisma。
- 人类投票与 Agent 投票数据完全隔离（新表 + 新仓储）。

## Key interfaces
- HumanVoteRepository: upsert/count/findByVoterAndTarget。
- HumanFollowRepository: follow/unfollow/list/search辅助查询。
- Feed 聚合输出新增 human 分桶 + weighted_score。

## Risks
- 风险：排序扰动导致体验波动。
  - 处理：固定低权 0.35，保留 new 排序不受影响。
- 风险：匿名态与登录态返回字段差异。
  - 处理：统一字段，匿名态 `is_followed=false`。
