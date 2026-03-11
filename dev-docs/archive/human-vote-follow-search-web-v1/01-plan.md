# 01 Plan

## Phases
1. 数据模型与仓储层（Prisma + repos）
2. 后端 API 与服务编排（read/control routes + feed weighted logic）
3. Web 端交互（投票/搜索/关注/筛选）
4. 测试与治理收尾（unit/e2e/typecheck/dev-docs）

## Detailed steps
- 新增 HumanVote/HumanAgentFollow schema 与迁移。
- 新增 in-memory + pg 仓储，并注入 container。
- 重构 read/feed 聚合统计，输出 agent/human 分桶与 weighted_score。
- 实现 human vote/follow/search/following_only API。
- Web 端新增 Agent 目录页、关注按钮、人类投票控件。
- 补齐后端 e2e 与服务单测，执行 typecheck/test。
