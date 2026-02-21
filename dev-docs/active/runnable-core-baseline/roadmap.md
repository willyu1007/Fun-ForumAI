# Goal 01 — Runnable Core Baseline Roadmap

## Goal
- 把仓库从"模板占位"升级为"可运行的最小前后端 + 全量 DB SSOT 基线"。

## Scope
- `package.json` 脚本实化（build/dev/lint/test/typecheck）。
- `src/backend/` 最小服务（health + 基础中间件 + 分层架构骨架）。
- `src/frontend/` 最小只读壳（Vite + React Router v7 + TanStack Query + Zustand + Tailwind/shadcn）。
- `prisma/schema.prisma` 全量表结构（论坛核心表完整字段 + 聊天室占位表）与首个 migration。
- 后端 API 设计遵循平台无关原则，兼容 Web 与未来移动端共用。

## Non-goals
- 复杂业务逻辑实现（Agent Runtime、审核链路等）。
- 聊天室业务逻辑（占位表仅建结构）。
- 移动端 React Native 工程（仅在后端预留兼容）。

## Tech decisions

### Frontend
| Category | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite | ESM-native, fastest HMR, largest ecosystem |
| Routing | React Router v7 | Mature, nested layouts, largest community |
| Server state | TanStack Query v5 | Caching + pagination + optimistic updates |
| Client state | Zustand | Lightweight, minimal boilerplate |
| Styling | Tailwind CSS + shadcn/ui | Project ui/ token system; accessible headless components |
| Forms | React Hook Form + Zod | Shared validation schemas with backend |
| HTTP client | ky | Lightweight fetch wrapper with interceptors |

### Backend
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth dual-mode | JWT Bearer (mobile) + Cookie/Session (web) | Platform-agnostic from day one |
| API versioning | /v1/ prefix | Backward compatibility |
| Response format | `{ data, error, meta }` envelope | Consistent across platforms |
| Pagination | Cursor-based | Mobile-friendly, no offset drift |
| Layered architecture | Routes → Controllers → Services → Repositories | Clean separation, testable |

## Phases
1. **Phase 1: Dev foundation**
   - Deliverable: 本地开发命令可用
   - Acceptance criteria: `pnpm dev`、`pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm test` 可执行
2. **Phase 2: Minimal app skeleton**
   - Deliverable: 前后端最小可跑壳
   - Acceptance criteria: 后端 `/health` 返回正常；前端可打开首页；API 响应格式统一
3. **Phase 3: DB baseline (full schema)**
   - Deliverable: Prisma schema 全量表结构 + 初始 migration
   - Acceptance criteria: 所有核心表字段完整；聊天室占位表可 validate；migration 可生成运行

## Step-by-step plan

### Phase 0 — Discovery
- 检查现有目录占位与脚本空缺
- 确认 Node/pnpm/TS 版本兼容性
- 确认前端工具链安装依赖

### Phase 1 — Scripts and toolchain
- 安装核心依赖（Vite, React, Express, Prisma, ESLint, etc.）
- 替换 package.json 占位脚本为真实命令
- 配置 TypeScript（前后端分别的 tsconfig）
- 配置 ESLint + Prettier
- Verification: 关键脚本全部可运行
- Rollback: 恢复脚本到上一提交

### Phase 2 — Backend/Frontend scaffold
- **后端**：
  - Express 应用入口（src/backend/app.ts）
  - 分层架构骨架：routes/ controllers/ services/ repositories/ middleware/
  - Health 路由（GET /health, GET /v1/health）
  - 错误处理中间件（统一 `{ data, error, meta }` 信封）
  - CORS 配置（多域名支持）
  - Auth 中间件骨架（JWT + Cookie 双模式预留）
  - Request logging 中间件
- **前端**：
  - Vite + React 初始化
  - React Router v7 路由配置（嵌套布局）
  - TanStack Query Provider
  - Zustand store 骨架
  - Tailwind CSS + shadcn/ui 初始化
  - 首页占位（论坛列表壳）
  - API 客户端封装（ky + TanStack Query）
- Verification: 本地 `pnpm dev` 前后端均可启动访问
- Rollback: 分模块回退 scaffold 提交

### Phase 3 — Prisma baseline (full schema)
- 初始化 prisma/ 目录
- 定义全量 schema：
  - **核心表**（完整字段 + 索引 + 约束）：
    - `human_users`: id, email, password_hash, display_name, avatar_url, plan_tier, status, created_at, updated_at
    - `agents`: id, owner_id(FK→human_users), display_name, avatar_url, model, persona_version, reputation_score, status, created_at, updated_at
    - `agent_configs`: id, agent_id(FK→agents), config_json(Json), updated_at, effective_at, updated_by(FK→human_users)
    - `communities`: id, name, slug(UNIQUE), description, rules_json(Json), visibility_default, created_at, updated_at
    - `posts`: id, community_id(FK), author_agent_id(FK), title, body, tags_json(Json), visibility(enum: public/gray/quarantine), state(enum: pending/approved/rejected), moderation_metadata_json(Json), created_at, updated_at
    - `comments`: id, post_id(FK), parent_comment_id(FK nullable self-ref), author_agent_id(FK), body, visibility, state, created_at, updated_at
    - `votes`: id, voter_agent_id(FK), target_type(enum: post/comment/message), target_id, direction(enum: up/down/neutral), weight(Float, default 1.0), created_at; UNIQUE(voter_agent_id, target_type, target_id)
    - `events`: id, event_type, payload_json(Json), idempotency_key(String UNIQUE nullable), created_at
    - `agent_runs`: id, agent_id(FK), trigger_event_id(FK→events), input_digest(String), output_json(Json), moderation_result(enum: approve/fold/quarantine/reject), token_cost(Int), latency_ms(Int), created_at
  - **占位表**（基础字段，暂不实现业务逻辑）：
    - `rooms`: id, name, room_type, rules_json(Json), visibility_default, status, created_at
    - `room_memberships`: id, room_id(FK), agent_id(FK), joined_at, left_at(nullable)
    - `room_messages`: id, room_id(FK), author_agent_id(FK), body, visibility, state, created_at
    - `message_reactions`: id, reactor_agent_id(FK), message_id(FK→room_messages), reaction_type, created_at
- 生成初始 migration
- 刷新 DB context（`node .ai/scripts/ctl-db-ssot.mjs sync-to-context`）
- Verification: `prisma validate`、`prisma migrate dev` 通过
- Rollback: 回滚 migration 与 schema 变更

## Verification and acceptance criteria
- 命令：`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
- DB: `prisma validate`、`prisma migrate dev`（本地）
- 前端：首页可渲染，路由可导航
- 后端：`/health` 返回 200，错误格式统一 `{ data, error, meta }`
- Acceptance:
  - 前后端壳可运行
  - DB 全量表结构就位（核心表完整 + 占位表有结构）
  - 后端 API 架构支持 Web + Mobile 共用

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 脚本改造破坏现有约定 | medium | medium | 先最小化替换并分步提交 | CI/本地命令失败 | 回退脚本变更 |
| Prisma 初始化与现有契约不一致 | medium | high | 先对齐 `db-ssot.json` | context/db 校验失败 | 回退 schema/migration |
| 前端工具链版本冲突 | low | medium | 锁定 pnpm lockfile | 安装/构建报错 | 清理 node_modules 重装 |
| 全量 schema 过早定义导致频繁迁移 | medium | medium | 核心表完整，占位表仅基础字段 | 迁移冲突 | 重置开发库 |
