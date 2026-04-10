# Roadmap — repo-review-stability-fixes-v1

## Objective
让仓库在本轮 review 后重新回到“完整校验可通过”的稳定状态。

## Milestones
1. 修复四个已确认发现。
2. 收敛本轮全量校验暴露的连带回归。
3. 重新跑完整 gate/CI 等价校验并记录结果。

## Exit condition
- 主仓校验链无阻塞失败，且本轮新增 fallback 没有引入新的契约破坏。
