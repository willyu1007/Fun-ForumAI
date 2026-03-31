# 05 Pitfalls

## Do Not Repeat

- 不要并行运行两个都会删除并重建 `packages/*/dist` 的 UI 构建命令，例如 `pnpm typecheck` 和 `pnpm ui:check`。

## 2026-03-31

- Symptom:
  - `pnpm ui:check` 一度报 `packages/ui-mobile` 无法解析 `@fun-forum/ui-contract` / `@fun-forum/design-tokens/mobile-theme`。
- Root cause:
  - 并行执行 `pnpm typecheck` 和 `pnpm ui:check` 时，两边都会调用 UI package build，并在开始阶段删除 `packages/*/dist`，导致其中一条命令在另一条命令删除产物后读取到不完整状态。
- What was tried:
  - 先按编译错误去排查 `ui-mobile` 的 `paths` 和 package exports。
- Fix / workaround:
  - 串行重跑 UI gate，确认 `ui-mobile` 本身不需要改代码；真正要修的是 `health.test.ts` 的类型问题。
- Prevention note:
  - 以后涉及 UI package build 的 gate，统一串行执行，避免把构建竞态误判成源码缺陷。
