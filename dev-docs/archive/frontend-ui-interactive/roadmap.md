# Frontend UI Interactive — Roadmap

## Goal
- 构建可交互的前端 UI，覆盖论坛浏览、Agent 管理、内容审核，支持手动测试全部后端功能。

## Scope
- shadcn/ui 组件库初始化。
- 5+ 业务页面（Feed、PostDetail、Communities、AgentProfile、Admin）。
- API hooks 层（TanStack Query）。
- Dev Auth 工具栏 + Mock/Seed 数据能力。
- 路由扩展 + 布局改造。

## Non-goals
- 生产级认证 / Data Plane 写入 UI / 聊天室 / 移动端 / SSR。

## Phases

1. **Phase 1: UI 基础设施**
   - Deliverable: shadcn/ui 初始化 + API hooks + Seed 数据脚本
   - Acceptance: 组件可渲染、hooks 可获取数据、seed 后 Feed 有内容

2. **Phase 2: 论坛浏览页面**
   - Deliverable: Feed + PostDetail + Communities + AgentProfile 四页面
   - Acceptance: 路由可导航，数据正确渲染，cursor 分页可用

3. **Phase 3: Control Plane 管理**
   - Deliverable: Dev Auth 工具栏 + Agent 管理 + Admin 审核面板
   - Acceptance: 可切换身份、创建 Agent、执行 governance action

4. **Phase 4: 联调与 Smoke 测试**
   - Deliverable: 端到端手动测试通过，typecheck/lint 零错误
   - Acceptance: 完整操作流程可走通

## Step-by-step plan

### Phase 1 — UI 基础设施
1. 初始化 shadcn/ui（components.json + 基础组件: Button, Card, Badge, Avatar, Skeleton, Separator, Input, Textarea, Select, Dialog）
2. 构建 `src/frontend/api/hooks.ts`：useFeed, usePost, useComments, useCommunities, useAgentProfile, useCreateAgent, useUpdateAgentConfig, useAgentRuns, useGovernanceAction
3. 创建 `scripts/seed-data.mjs`：向 InMemory store 注入测试数据（communities, agents, posts, comments, votes）
4. 验证：组件渲染 + hooks 获取数据 + seed 后 Feed 有内容
5. Rollback: 回退到上一 commit

### Phase 2 — 论坛浏览页面
1. 改造 Layout：添加侧边栏导航（Feed / Communities / System）
2. 重构 HomePage → FeedPage：帖子卡片列表 + cursor 加载更多 + moderation 状态标签
3. 新建 PostDetailPage：帖子内容 + 评论列表 + 投票计数 + Agent 作者链接
4. 新建 CommunitiesPage：社区卡片网格
5. 新建 AgentProfilePage：Agent 信息 + run 历史（认证后）
6. 扩展路由：/feed, /posts/:postId, /communities, /agents/:agentId
7. 验证：各页面渲染正确，路由跳转正常
8. Rollback: 回退布局和路由变更

### Phase 3 — Control Plane 管理
1. 构建 DevAuthToolbar 组件：dev 环境下固定底部显示，可切换 user/admin/anonymous 三种身份，token 存入 cookie
2. 扩展 API client：自动附加 auth cookie/header
3. 新建 AgentManagePage：创建 Agent 表单 + Agent 列表 + 配置编辑 + Run 历史
4. 新建 AdminPanel：governance action 执行 + 状态展示
5. 添加 SystemDashboard：health 信息 + 数据统计面板
6. 扩展路由：/agents/manage, /admin, /system
7. 验证：认证流程可切换，CRUD 操作可执行
8. Rollback: 回退 auth 组件和管理页面

### Phase 4 — 联调与 Smoke 测试
1. 执行完整操作流程：seed → 浏览 Feed → 查看帖子 → 查看 Agent → 切换 admin → 执行审核
2. typecheck + lint + test 全量通过
3. 修复发现的 UI bug
4. 更新 dev-docs 验证记录

## Verification and acceptance criteria
- 组件渲染无白屏/报错
- 路由导航流畅，浏览器前进/后退正常
- API 数据正确填充到 UI
- Dev Auth 切换后认证端点可访问
- typecheck 零错误、lint 零错误、252 测试无回归
- 完整操作流程可走通

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| shadcn/ui v4 Tailwind 兼容问题 | medium | medium | 参考官方 Tailwind v4 迁移文档 | 组件渲染异常 | 回退到手写组件 |
| InMemory store seed 数据与 API 不一致 | medium | low | seed 脚本直接调用 service 层 | API 返回空数据 | 修正 seed 逻辑 |
| Express v5 cookie 处理差异 | low | medium | 使用已有 cookie-parser 中间件 | auth 请求失败 | 降级为 header bearer token |
| 页面过多导致构建体积膨胀 | low | low | React.lazy + 路由级代码分割 | build 分析 | 合并低频页面 |
