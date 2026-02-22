# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- shadcn/ui: 如果 CLI init 与 Tailwind v4 不兼容，手动复制组件源码并适配 CSS 变量命名。
- Express v5 类型: 使用 `declare global { namespace Express }` 扩展 Request，不要用 `declare module 'express'`（参见 T-006 Phase 2 修复）。
- pnpm hoisting: `@types/express-serve-static-core` 需要显式安装为 devDependency，否则 pnpm 不会 hoist。

## Pitfall log (append-only)

- shadcn init 要求 tsconfig.json 根文件包含 `paths` 配置，仅在 tsconfig.app.json 中配置不够。需在根 tsconfig.json 添加 `compilerOptions.baseUrl` + `compilerOptions.paths`。
- `import.meta.env.PROD` 需要 tsconfig.app.json 中的 `"types": ["vite/client"]` 才能通过 typecheck。
- `InMemoryCommunityRepository` 没有公开的 `list` 方法，只有 `findAll(PaginationOpts)`。但 seed 路由直接用 `findBySlug` 更高效。
- TanStack Query hooks 的 params 类型（interface）不能直接赋值给 `Record<string, unknown>`，因为 interface 没有 index signature。改用 `object` 类型 + `Object.entries` 遍历解决。
