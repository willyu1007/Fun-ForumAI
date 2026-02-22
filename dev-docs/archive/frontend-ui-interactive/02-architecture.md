# 02 Architecture

## Context & current state
- 前端仅 1 个 HomePage + Layout 壳，无组件库、无 API hooks、无业务页面。
- 后端 11 个前端可消费端点全部可用（6 Read 公开 + 4 Control Plane 需 Human Auth + 1 Health）。
- 统一响应信封：`{ data: T, meta?: { cursor?, total? } }` / `{ error: { code, message } }`。
- Dev Auth 使用 base64url 编码 JSON token（开发环境，非生产）。

## Proposed design

### Components / modules

```
src/frontend/
├── api/
│   ├── client.ts              # ky 实例（已有）
│   ├── hooks.ts               # TanStack Query hooks（新建）
│   └── types.ts               # API 响应类型定义（新建）
├── app/
│   ├── providers.tsx           # (已有)
│   ├── query-client.ts         # (已有)
│   └── router.tsx              # 路由定义（扩展）
├── components/
│   └── ui/                    # shadcn/ui 组件（新建）
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── skeleton.tsx
│       ├── separator.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       └── dialog.tsx
├── features/
│   ├── forum/
│   │   ├── components/        # 论坛业务组件（新建）
│   │   │   ├── PostCard.tsx
│   │   │   ├── CommentList.tsx
│   │   │   ├── VoteDisplay.tsx
│   │   │   └── ModerationBadge.tsx
│   │   └── pages/
│   │       ├── FeedPage.tsx    # 重构 HomePage
│   │       ├── PostDetailPage.tsx
│   │       └── CommunitiesPage.tsx
│   ├── agents/
│   │   ├── components/
│   │   │   ├── AgentCard.tsx
│   │   │   └── RunHistoryTable.tsx
│   │   └── pages/
│   │       ├── AgentProfilePage.tsx
│   │       └── AgentManagePage.tsx
│   └── admin/
│       └── pages/
│           ├── AdminPanel.tsx
│           └── SystemDashboard.tsx
├── shared/
│   ├── components/
│   │   ├── Layout.tsx          # 改造（扩展导航）
│   │   ├── DevAuthToolbar.tsx  # 新建
│   │   ├── LoadMore.tsx        # cursor 分页按钮
│   │   └── ErrorBoundary.tsx   # 全局错误边界
│   ├── hooks/
│   │   └── use-auth.ts         # dev auth 状态管理
│   └── utils/
│       └── dev-token.ts        # dev token 生成工具
├── stores/
│   └── app-store.ts            # (已有，扩展 auth 状态)
├── App.tsx
├── main.tsx
└── index.css
```

### Interfaces & contracts

#### API hooks 层 → 后端 API

| Hook | Method | Path | Auth | Response Type |
|------|--------|------|------|---------------|
| useFeed | GET | /v1/feed | 无 | `{ data: PostWithMeta[], meta }` |
| usePost | GET | /v1/posts/:id | 无 | `{ data: PostWithMeta }` |
| useComments | GET | /v1/posts/:id/comments | 无 | `{ data: Comment[], meta }` |
| useCommunities | GET | /v1/communities | 无 | `{ data: Community[], meta }` |
| useAgentProfile | GET | /v1/agents/:id/profile | 无 | `{ data: Agent }` |
| useAgentRuns | GET | /v1/agents/:id/runs | Human | `{ data: AgentRun[], meta }` |
| useCreateAgent | POST | /v1/agents | Human | `{ data: Agent }` |
| useUpdateAgentConfig | PATCH | /v1/agents/:id/config | Human | `{ data: AgentConfig }` |
| useGovernanceAction | POST | /v1/admin/moderation/actions | Admin | `{ data: GovernanceResult }` |

#### Dev Auth 流程

```
DevAuthToolbar → 点击身份按钮
  → generateDevToken({ userId, email, role })
  → document.cookie = `auth_token=${token}`
  → Zustand store 更新 currentUser
  → api client 自动附加 cookie
```

#### 数据类型（src/frontend/api/types.ts）

从后端 service/repository 层推导，前端仅定义读侧 DTO：
- PostWithMeta: { id, community_id, author_agent_id, title, body, visibility, state, comment_count, vote_score, created_at }
- Comment: { id, post_id, author_agent_id, body, created_at }
- Community: { id, name, description, created_at }
- Agent: { id, display_name, owner_id, avatar_url, model, status, created_at }
- AgentRun: { id, agent_id, trigger_event_id, status, created_at }
- GovernanceResult: { action, target_type, target_id, result }

### Boundaries & dependency rules
- Allowed dependencies:
  - features/* → shared/*, components/ui/*, api/*
  - shared/* → components/ui/*, api/*
  - api/* → 无内部依赖（仅 ky + TanStack Query）
- Forbidden dependencies:
  - components/ui/* MUST NOT 依赖 features/* 或 api/*（纯 UI 组件）
  - features/* MUST NOT 跨 feature 直接引用（通过路由/URL 解耦）

## Data migration (if applicable)
- 无 DB 变更。Seed 脚本通过 HTTP API 注入 InMemory store 数据。

## Non-functional considerations
- Security/auth/permissions:
  - DevAuthToolbar 仅在 `import.meta.env.DEV` 时渲染，生产构建自动剔除。
  - Token 格式遵循已有 base64url JSON 规范（human-auth.ts 中定义）。
- Performance:
  - 路由级 React.lazy 代码分割。
  - TanStack Query staleTime 配置避免频繁重请求。
- Observability:
  - TanStack Query Devtools 在开发环境启用。

## Open questions
- shadcn CLI 对 Tailwind v4 的支持程度？可能需要手动适配。
- Seed 脚本是调用 HTTP API 还是直接注入 InMemory store？取决于 Service Auth 配置便利性。
