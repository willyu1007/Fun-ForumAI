# 01 Plan — T-050

## PKG-0 Governance Reopen
1. 任务状态改为 `in_progress` 并同步治理索引。
2. 在任务文档补录“并入新增缺口”的冻结决策与验收项。

## PKG-1 Security & Membership Hardening
1. 修复 memberships patch/add 恢复漏洞。
2. backfill 按 current membership（left_at=null）去重，避免反向解封。
3. `upsertActive` 默认保留现有 status 与审计字段。

## PKG-2 Flag Semantics + Stage Fallback + Hot-path
1. 候选池 membership 口径改为 current membership（不含 status 过滤）。
2. 仅在 `membershipStatusV1=true` 时执行 ACTIVE gate。
3. 缺失/非法 `stage_spec` 使用可用性优先 fallback（strict_t4 关闭、aftershow OFF）。
4. allocator membership 状态判断改为“一次查询 + map O(1) 判定”。

## PKG-3 Incubation State Machine
1. `review-verdict=approve` 只记录审核通过，不再置 `GRANTED`。
2. `grant` 成为唯一 `PENDING -> GRANTED` 入口。
3. `grant` 非法状态返回冲突错误。
4. 收敛 API actor 语义：`reviewer_user_id` 从请求体移除，固定使用认证用户。
5. review 增加前置 guard：仅 `PENDING` 允许 review。

## PKG-4 Audience + Stage Template Ops
1. audience-messages 接入 zod schema 校验。
2. 脚本与控制面统一 YAML parse/stringify。
3. season-rotate 生产环境仅 dry-run。
4. Admin 按钮在生产走 dry-run + 脚本提示。
5. season-rotate 写入链路升级为原子提交 + best-effort 回滚。

## PKG-5 Docs & Governance
1. 项目级文档登记 Aftershow 权限遗留问题。
2. 同步任务索引与项目治理文件。
3. 完成新增缺口验证后将任务状态回写为 `done`。

## Verification Gates
1. 单元测试：membership/incubation/stage-spec。
2. 路由/E2E：memberships status、audience validation、season-rotate prod guard。
3. 脚本：stage template validate/export/rotate 在 YAML 文件上可运行。
4. 新增：incubation strict schema（unknown field=400）、review 非 pending 冲突、rotation 失败回滚、allocator hot-path 语义等价。
