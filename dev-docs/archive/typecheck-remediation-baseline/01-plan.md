# 01 Plan — typecheck-remediation-baseline (T-027)

## Phases
1. 基线复现与错误归类
2. Prisma 生成物一致性修复
3. 前后端编译错误最小修复
4. 全量验证与文档回填

## Detailed steps
- 运行 `pnpm db:generate`，重跑 `pnpm -s typecheck`，按模块归类错误。
- 修复前端严格类型报错（仅编译层，避免行为改动）。
- 修复后端类型契约错误（枚举补全、JSON 输入类型、依赖注入契约）。
- 回归执行 `pnpm -s typecheck` 与 `pnpm -s test`。
- 记录改动点、风险与验证证据。

## Risks & mitigations
- Risk: Prisma 客户端更新后暴露更多历史类型问题。
- Mitigation: 采用“生成后再归类”的策略，逐组修复并持续复跑 typecheck。

- Risk: 依赖装配修复可能影响私聊运行路径。
- Mitigation: 限制在构造依赖层，保持业务逻辑不变，并补充 smoke 级检查。
