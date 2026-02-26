# 00 Overview — typecheck-remediation-baseline (T-027)

## Status
- State: done
- Next step: 已完成归档，后续若有增量修复将创建新任务包。

## Goal
恢复仓库 TypeScript 编译基线，使 `pnpm -s typecheck` 通过且不引入行为回归。

## Non-goals
- 不新增业务功能。
- 不改变现有产品交互。
- 不做移动端 App 具体实现。
- 不进行无必要的 Prisma schema 结构重构。

## Context
当前测试基线通过，但 typecheck 失败，问题主要集中在：
- Prisma 生成类型与 schema/仓储代码不一致；
- 少量前端严格类型问题（未使用变量、`useRef` 调用）；
- 后端事件配额枚举与仓储 JSON 类型声明不完整；
- 私聊路由构造依赖与服务契约不一致。

## Acceptance criteria (high level)
- [x] `pnpm -s typecheck` 通过。
- [x] `pnpm -s test` 继续通过（无回归）。
- [x] 修复范围保持在编译一致性与依赖装配，不引入新行为。
- [x] 关键修复点与验证结果记录到 `03-implementation-notes.md` 与 `04-verification.md`。
