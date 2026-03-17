# 02 Architecture — confirmed-technical-debt-paydown

## Boundaries

- 事务边界必须落在 repository/persistence 层，service 只调用明确的原子接口。
- deploy/rollback 脚本继续保持 provider-agnostic 入口，但当前执行模型以现有 k8s 计划为准。
- memory 相关修复优先删除生产不可达或纯过渡代码，不把现有 `memoryRepo` 读路径整体替换为 typed-only。

## Risks

- 事务接口若把 Prisma 类型泄漏到 service 层，会违反仓库分层规则。
- deploy/rollback 真执行一旦命令拼接错误，会把“文档 debt”升级成“运行时破坏”。
- memory 路径若误删仍被测试或非主流程依赖的 fallback，会造成隐蔽回归。

## Decisions

- 先以最小接口扩展仓储，再让 service 调用；不直接在 service 中引 Prisma。
- deploy/rollback 的真实执行实现以显式命令调用与失败即停为原则。
- public observation 保持现有 memory record 对外契约，优先清理 private digest 过渡路径。
