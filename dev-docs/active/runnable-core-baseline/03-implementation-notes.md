# 03 Implementation Notes

## Status
- Current status: in-progress
- Last updated: 2026-02-21

## What changed

### 2026-02-21 — Phase 1: Scripts and toolchain
- 安装全部生产依赖（Express 5, React 19, React Router 7, TanStack Query 5, Zustand 5, ky, Zod 4, etc.）
- 安装全部开发依赖（Vite 7, Tailwind CSS 4, ESLint 10, Vitest 4, Prisma 7, tsx, etc.）
- 替换 package.json 占位脚本为真实命令
- 拆分 tsconfig：root references → tsconfig.app.json (frontend) + tsconfig.node.json (backend)
- 配置 Vite（dev proxy 到后端 :4000）、ESLint flat config、Prettier、Vitest

### 2026-02-21 — Phase 2: Backend scaffold
- Express 5 应用入口（app.ts + server.ts）
- 分层架构目录：routes/ controllers/ services/ repositories/ middleware/ lib/
- Health 路由：GET /health 和 GET /v1/health
- 错误处理中间件：统一 `{ error: { code, message, details? } }` 信封
- CORS 多域名支持、Helmet 安全头、压缩、cookie-parser、请求日志
- 自定义错误类型：AppError, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError
- 统一响应类型：`ApiResponse<T> = { data: T, meta? }`
- 优雅关闭（SIGTERM/SIGINT）

### 2026-02-21 — Phase 2: Frontend scaffold
- Vite + React 19 + TypeScript
- React Router v7（createBrowserRouter + RouterProvider）
- TanStack Query v5 Provider
- Zustand store 骨架
- Tailwind CSS v4（@tailwindcss/vite 插件，CSS-first 配置）
- shadcn/ui 基础 CSS 变量（oklch 色彩系统）
- ky API 客户端（带重试和错误拦截）
- 首页展示后端连接状态
- Layout 组件 + 嵌套路由

### 2026-02-21 — Phase 3: Prisma schema
- 13 张表全量定义（9 核心 + 4 聊天室占位）
- Prisma 7 配置（prisma.config.ts 管理 datasource URL）
- 枚举：Visibility, ContentState, VoteTarget, VoteDirection, AgentStatus, UserStatus, PlanTier, ModerationResult
- 关键约束：votes 唯一索引、room_memberships 唯一索引、comments 自引用树
- schema validate 通过

## Files/modules touched (high level)
- package.json (scripts + dependencies)
- tsconfig.json, tsconfig.app.json, tsconfig.node.json
- vite.config.ts, vitest.config.ts, eslint.config.js, .prettierrc
- index.html
- prisma.config.ts, prisma/schema.prisma
- src/backend/ (app, server, routes, middleware, lib)
- src/frontend/ (main, App, router, providers, Layout, HomePage, api client, store, CSS)

## Decisions & tradeoffs
- Decision: 使用 Prisma 7（而非 v6），适配新的 prisma.config.ts 模式
  - Rationale: 最新版本，长期维护优势
- Decision: 使用 Tailwind CSS v4 CSS-first 配置，不需要 tailwind.config.ts
  - Rationale: 更简洁，Vite 插件原生支持
- Decision: 后端使用 tsx 运行，不编译为 JS
  - Rationale: 开发和生产一致，简化流程
- Decision: Express 导出使用显式类型注解（`Express`, `IRouter`）
  - Rationale: TypeScript composite project 要求可移植类型

## Deviations from plan
- Prisma 7 不再支持 schema 内 `url` 配置，改用 prisma.config.ts（计划中未预见）
- vitest 配置独立为 vitest.config.ts（而非内嵌在 vite.config.ts）

## Known issues / follow-ups
- 需要本地 PostgreSQL 实例来运行 `prisma migrate dev`
- eslint-plugin-react-hooks 7 与 ESLint 10 有 peer dependency 警告（不影响功能）
- shadcn/ui 组件尚未安装（需要时按需添加）

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
