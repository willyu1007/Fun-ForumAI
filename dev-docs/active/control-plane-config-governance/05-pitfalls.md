# 05 Pitfalls — T-054

## do-not-repeat summary
- 迁移脚本改枚举值时，不能在旧枚举类型阶段写入新值（`DRAFT -> PROPOSED` 应在 `ALTER TYPE ... USING CASE` 中完成）。
- Prisma 迁移失败后必须先 `migrate resolve --rolled-back`，否则后续 `deploy` 会被 `P3009` 阻塞。
- 高风险 patch 进入 `SCHEDULED` 后，调度器 apply 校验必须允许 `SCHEDULED` 状态，否则会持续重试失败。
- 配置写入后必须补发组件激活事件（`COMMUNITY_CONFIG_ACTIVATED`），否则无法审计“规则被哪个组件消费”。
- 兼容入口（`/stage-spec`）必须走 proposal/approve/apply 流程，不能旁路控制面审计。
- config proposal 路由必须校验 `:communityId` 与 `proposal.community_id` 一致，否则会出现跨社区 proposal 操作漏洞。
- 状态机必须显式限制非法转移（例如 `PROPOSED -> APPROVED`、`REJECTED -> VALIDATED`），否则审批/拒绝语义会被绕过。
- 不要把 legacy 顶层 lint 规则机械平移到 `stage_spec_v1`；默认 StageSpec 可能与旧 patch 语义不同，误用会导致所有正常 proposal 在 validate 阶段被拒。
- 使用裸 SQL 为 Pg migration/probe 构造测试数据时，Prisma 的 `@updatedAt` 列没有数据库默认值，必须显式写入 `created_at / updated_at`。
- aftershow 阈值是 `audience_comments OR human_vote_score`，烟测如果把 `human_vote_score` 设成 `0` 会产生伪阳性，无法证明 runtime 真的读取了 audience 路径。
- mixed-shape 规范化是“`stage_spec_v1` 真源 + legacy 缺失字段归并”，不要把它描述成“legacy 顶层字段会自动修复并覆盖已有 `stage_spec_v1` 冲突值”。
