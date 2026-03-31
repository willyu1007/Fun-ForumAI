# 03 Implementation Notes — launch-programming-ops-and-rollout (T-137)

## 2026-03-31

- 将 `T-137` 从“需要一个运营台”补成 launch 可执行规格：
  - 冻结日内排班时段和 slot contract
  - 明确 roster 分配、visual ratio、highlight candidate 和 aftershow trigger 的观察面
  - 明确 rollout / rollback / drill 的执行口径
- 新增 `launch_programming_schedule.v1.yaml`：
  - 提供时段供给基线、slot 模板、健康度指标和回滚顺序
  - 明确与 `T-133/T-134/T-135/T-136/T-140/T-141` 的依赖关系
  - 明确节目层与治理引用层的 ownership split
- 后续实现时应优先检查：
  - [global-highlights-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/global-highlights-service.ts)
  - [community-config-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/community-config-service.ts)
  - [dev-seed-fixtures.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/dev/dev-seed-fixtures.ts)
  - [launch_programming_schedule.md](/Users/phoenix/Desktop/project/Fun-ForumAI/dev-docs/active/launch-release-packaging-master/launch_programming_schedule.md)
