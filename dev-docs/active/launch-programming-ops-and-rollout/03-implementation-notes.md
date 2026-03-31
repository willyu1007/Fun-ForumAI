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
- 新增 backend runtime contract loader：
  - [programming-schedule.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/launch/programming-schedule.ts) 直接消费 `launch_programming_schedule.v1.yaml`
  - 校验 4 个 canonical dayparts、12 个 launch communities、T-133 role vocabulary、T-135 shelf ids、T-140 surface kinds，以及 T-141 governance reference layer 的只读依赖
- 新增 launch ops 聚合服务：
  - [launch-programming-ops-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/launch-programming-ops-service.ts) 输出 home 轻量节目单和 admin 完整 read model
  - roster 推荐规则固定为 required role 优先、`home_community/resident_membership` 优先、T4 slot 优先 `t4_capable`、显式避让 `pairing_preferences.avoids`
  - `assigned_agent_ids` 语义固定为 `assignment_source: recommended_contract` 的动态推荐，不做持久化排班写入
  - health / observation 面复用现有 feed、highlights、aftershow、role assignment、community governance、media observability 数据现算
- 接通首页 `tonight_programming`：
  - [home-programming-service.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/home-programming-service.ts) 在 `FF_HOME_PROGRAMMING_V1=true` 且 `FF_PROGRAMMING_OPS_V1=true` 时注入 `programming_slot`
  - [HomePage.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/HomePage.tsx) 新增轻量节目卡，只展示 daypart、community、objective、expected output 和 1-2 个 lead seats
- 新增 Admin `Programming` tab：
  - [admin-api.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/routes/admin-api.ts) 新增 `GET /admin/launch/programming-ops`
  - [ProgrammingTab.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/admin/pages/admin-panel/ProgrammingTab.tsx) 以只读方式渲染 daypart baseline、slot recommendation、release health、visual/highlight/aftershow observation、governance/rollback
  - [AdminPanel.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/admin/pages/AdminPanel.tsx) 增加独立 `Programming` tab，不复用 Runtime/Governance 容器
- 同步 env / API / 类型面：
  - [config.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/lib/config.ts) 新增 `FF_PROGRAMMING_OPS_V1`
  - [contract.yaml](/Users/phoenix/Desktop/project/Fun-ForumAI/env/contract.yaml) 新增 `FF_PROGRAMMING_OPS_V1` 和 `VITE_FF_PROGRAMMING_OPS_V1`
  - [types.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/api/types.ts)、[admin.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/api/hooks/admin.ts)、[query-keys.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/api/query-keys.ts) 补齐 read model 类型与 hook
- 补充测试：
  - 新增 loader / service 单测
  - 扩展 home programming、admin route、home/admin page 测试，覆盖 `programming_slot` 注入与 Programming tab 渲染
- 实施中额外修复两处交付性问题：
  - `programming-schedule.ts` 的 expected output 归一化作用域错误，已在 typecheck 阶段修正
  - 首页入口卡片原先使用硬编码渐变，触发 UI governance gate，已改成 token-safe 的 `bg-card` 包装
