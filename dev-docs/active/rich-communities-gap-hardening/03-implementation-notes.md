# 03 Implementation Notes — T-050

## 2026-03-04
- 初始化任务包与实施范围。
- 按冻结决策实施，不新增 schema migration。
- PKG-1:
  - `patchMemberships(add)` 增加 non-ACTIVE 恢复拦截，指向 status API。
  - `runDerivedBackfill()` 改为按 current membership 去重，避免反向解封。
  - membership repo `upsertActive` 默认保留 status/audit；新增 current-by-community 查询口径。
- PKG-2:
  - allocator 候选池改用 current membership 列表。
  - 新增 membership gate helper 并补单测，确保 `membershipStatusV1=false` 不再隐式按 ACTIVE 过滤。
  - `stage_spec` 缺失/非法时改为可用性优先 fallback（`strict_t4=false`, `aftershow=OFF`）。
- PKG-3:
  - Incubation `review(approve)` 不再置 `GRANTED`，返回 `next_action=grant_required`。
  - `grant` 增加状态机校验，仅允许 `PENDING -> GRANTED`。
- PKG-4:
  - audience message 接口接入 schema 校验（trim/min/max）。
  - stage template 脚本与控制面统一改为 YAML parse/stringify。
  - 生产环境 season-rotate 非 dry-run 返回 FORBIDDEN；控制面按钮支持生产 dry-run 提示。
- PKG-5:
  - 在项目级风险文档登记 Aftershow 权限遗留问题。
  - 新建并完成 T-050 dev-docs 任务包。

## 2026-03-04 (并入新增缺口执行)
- PKG-0:
  - 任务包按并入版 reopened，补充并入范围、冻结决策与验收条目。
  - 治理索引通过 `ctl-project-governance sync --apply --project main` 同步。
- PKG-1:
  - `createIncubationGrantSchema` / `createIncubationReviewVerdictSchema` 移除 `reviewer_user_id` 并启用 `strict()`。
  - control-plane `grant/review-verdict` 仅将 `req.user.userId` 作为 `actor_user_id` 传入 service。
  - incubation service 入参统一为 `actor_user_id`，审计事件和授权记录只使用该身份。
- PKG-2:
  - `reviewJob()` 新增状态前置 guard：非 `PENDING` 直接返回 `409 CONFLICT`。
  - 保持 `approve` 语义为“仅审核通过，不授予 grant”，返回 `next_action=grant_required`。
- PKG-3:
  - 提取共享 helper `src/backend/stage/stage-template-ops.js`，统一 API 与脚本轮换逻辑。
  - 固定原子流程：读取 -> 内存旋转 -> 预构建 dist -> 临时文件写入 -> rename 提交。
  - 固定回滚策略：任一步失败执行 best-effort rollback，避免 manifest/dist 半提交。
- PKG-4:
  - allocator 候选池改为一次查询 current memberships，构建 `Map<agent_id, membership>`。
  - `getCandidates()` 循环内改为 map O(1) 状态读取，移除逐 agent repository 调用。
  - 保持 gate 语义不变：`membershipsV1` 控存在性，`membershipStatusV1` 控 ACTIVE。
- 测试并入:
  - 新增/更新 incubation strict body、actor 绑定、non-pending review 拒绝用例。
  - 新增 stage rotation 原子提交与失败回滚测试。
  - 更新 script 测试夹具，补齐真实 YAML 模板并校验 dist 同步输出。
