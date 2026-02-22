# 03 Implementation Notes

## Status
- Current status: done
- Last updated: 2026-02-22

## What changed

### Phase 1: UI 基础设施
- shadcn/ui CLI init 成功（Tailwind v4 兼容）
- 安装 10 个基础组件：Button, Card, Badge, Avatar, Skeleton, Separator, Input, Textarea, Select, Dialog
- 配置 `@/` import alias（tsconfig.json + tsconfig.app.json + vite.config.ts）
- 创建 `api/types.ts`（完整前端 DTO 类型）
- 创建 `api/hooks.ts`（9 个 TanStack Query hooks）
- 更新 `api/client.ts`（自动附加 auth cookie）
- 创建 `shared/utils/dev-token.ts` + `shared/hooks/use-auth.ts`
- 后端新增 `routes/dev-seed.ts`（dev-only seed 路由）
- container.ts 导出 communityRepo
- 创建 `scripts/seed-data.mjs` + package.json `seed` 脚本

### Phase 2: 论坛浏览页面
- Layout.tsx 改造：顶部 sticky 导航栏 + 4 个路由链接
- FeedPage：PostCard 列表 + 空状态引导 + 健康检查
- PostCard：标题/标签/投票/评论数/moderation badge
- PostDetailPage：完整帖子 + CommentList
- CommunitiesPage：社区卡片网格
- AgentProfilePage：Agent 信息卡 + RunHistoryTable
- router.tsx：6 条路由 + React.lazy 代码分割

### Phase 3: Control Plane 管理
- DevAuthToolbar：底部 sticky 工具栏，Anonymous/User/Admin 切换 + Seed 按钮
- AgentManagePage：创建 Agent 表单 + 已创建列表
- AdminPanel：Governance Action 表单 + 系统状态 + 操作历史

### Phase 4: 联调与 Smoke 测试
- pnpm seed 成功（4 communities, 5 agents, 5 posts, 10 comments）
- 浏览器 Smoke 测试全通过

## Files/modules touched (high level)
- tsconfig.json, tsconfig.app.json, vite.config.ts（alias + vite/client types）
- src/frontend/index.css（shadcn 更新）
- src/frontend/lib/utils.ts（shadcn cn 工具）
- src/frontend/components/ui/*（10 个 shadcn 组件）
- src/frontend/api/types.ts, hooks.ts, client.ts
- src/frontend/shared/utils/dev-token.ts
- src/frontend/shared/hooks/use-auth.ts
- src/frontend/shared/components/Layout.tsx, DevAuthToolbar.tsx, LoadMore.tsx
- src/frontend/features/forum/components/PostCard.tsx, CommentList.tsx, ModerationBadge.tsx, VoteDisplay.tsx
- src/frontend/features/forum/pages/FeedPage.tsx, PostDetailPage.tsx, CommunitiesPage.tsx
- src/frontend/features/agents/components/RunHistoryTable.tsx
- src/frontend/features/agents/pages/AgentProfilePage.tsx, AgentManagePage.tsx
- src/frontend/features/admin/pages/AdminPanel.tsx
- src/frontend/app/router.tsx
- src/backend/routes/dev-seed.ts（新增）
- src/backend/container.ts（export communityRepo）
- src/backend/app.ts（注册 devSeedRouter）
- scripts/seed-data.mjs（新增）
- package.json（seed 脚本）
- components.json（shadcn 配置）

## Decisions & tradeoffs
- Decision: 使用 shadcn/ui 而非完全自定义组件
  - Rationale: shadcn 提供可复制的高质量组件源码，与 Tailwind v4 + CSS 变量兼容，且不引入运行时依赖。
- Decision: Seed 通过后端 dev-only 路由而非 Data Plane HMAC API
  - Rationale: 避免在前端/脚本中复现 HMAC 签名逻辑；直接调用 service 层更简单且仍经过 moderation pipeline。
  - Alternatives considered: 通过 Data Plane API + Service Auth 签名（过于复杂）。
- Decision: Dev Auth 使用 cookie + useSyncExternalStore
  - Rationale: 后端 human-auth.ts 已支持从 cookie 读取 token，useSyncExternalStore 避免了 Zustand 冗余状态。

### Phase 5: 中文本地化 + 品牌升级
- 全量 UI 文本本地化为中文（上下文翻译，非直译）
- 品牌标识：MoreThan 品牌 icon 替换，favicon + PWA 图标就位
- index.html：lang=zh-CN，标题更新
- index.css：indigo/violet 品牌色系 + 中文字体优先级
- Seed 数据全部中文化

### Phase 6: Reddit 风格 UI 改造
- 三栏布局：Layout.tsx 重构为 AppShell（TopBar + LeftSidebar + Content + RightSidebar）
- TopBar：汉堡菜单 + Logo + 创建按钮 + 用户下拉菜单（DropdownMenu）
- LeftSidebar：社区列表 + 快捷导航 + 管理入口，移动端 Sheet 抽屉
- RightSidebar：上下文感知（首页=平台简介+热门社区，社区页=社区详情）
- 帖子双视图：PostCard（Reddit 风格卡片）+ PostCompact（紧凑行）+ FeedToolbar（排序 Tab + 视图切换）
- 新增路由 `/c/:slug` → CommunityFeedPage（subreddit 风格社区独立页）
- PostDetailPage：投票列 + 线程式评论
- 新增 VoteColumn 组件替代 VoteDisplay
- 新增 relativeTime 工具（Intl.RelativeTimeFormat zh-CN）
- 新增 useCommunityBySlug hook
- 安装 7 个 shadcn 组件：dropdown-menu, sheet, tabs, tooltip, toggle-group, scroll-area, toggle
- 响应式断点：左栏 md(768px+)，右栏 lg(1024px+)
- Zustand stores：sidebar-store（折叠状态）, feed-view-store（卡片/紧凑偏好 + localStorage）

## Deviations from plan
- Seed 脚本改为调用后端 dev-only 路由（`POST /v1/dev/seed`）而非 Data Plane API。原因是 Data Plane 需要 HMAC 签名且无法创建 community。
- HomePage 保留但不再使用（路由指向 FeedPage）。

## Known issues / follow-ups
- 表单元素缺少 label 关联（辅助功能改进项，非阻塞）。
- router.tsx 的 react-refresh warnings（lazy import 标准模式，不影响功能）。
- Agent Profile 页显示 agent ID 而非 display_name 作为帖子作者——需后端 Read API 返回 agent 名称映射。

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in 05-pitfalls.md (append-only).
