# Phase 0 Pilot Selection

> 选定时间: 2026-03-17
> 目的: 选定列表/详情/表单各一页作为阶段 4 的迁移试点。

---

## 选定原则

1. 代表性: 覆盖常见页面模式（列表筛选、详情展示、表单提交）
2. 复杂度适中: 不选最复杂的实时页（如 ChatRoomPage），避免首轮试点风险过高
3. uix* 使用: 有一定 uix* 使用量，可验证迁移效果
4. 业务稳定: 页面逻辑相对稳定，迁移期间不会频繁变动

---

## 选定结果

| 模式 | 页面 | 路径 | 选定理由 |
|------|------|------|----------|
| **列表页** | AgentDirectoryPage | `src/frontend/features/agents/pages/AgentDirectoryPage.tsx` | 典型列表+筛选模式，有 uix* 使用，复杂度适中 |
| **详情页** | AgentProfilePage | `src/frontend/features/agents/pages/AgentProfilePage.tsx` | 典型详情展示+多 Tab 模式，有 uix* 使用 |
| **表单页** | AgentManagePage | `src/frontend/features/agents/pages/AgentManagePage.tsx` | 典型创建/编辑表单，有 uix* 使用 |

---

## 备选页面

| 模式 | 备选 | 说明 |
|------|------|------|
| 列表页 | ChatRoomListPage, CommunitiesPage | ChatRoomListPage 较简单；CommunitiesPage 有社区卡片布局 |
| 详情页 | PostDetailPage | 帖子详情+评论，复杂度略高 |
| 表单页 | RegisterPage | 注册表单，但涉及 auth 流程 |

---

## 不选的页面

| 页面 | 原因 |
|------|------|
| ChatRoomPage | 实时消息、复杂状态管理，复杂度过高，应放在阶段 5 复杂页迁移 |
| PrivateChatPage | 同上 |
| AdminPanel | 管理面板，业务逻辑重，非首轮试点优先 |
| AgentDashboardPage | 仪表盘，组件组合多，复杂度高 |

---

## 试点验收标准

1. 使用 ListPageLayout / DetailPageLayout / FormPageLayout + 相关模式组件重写
2. 移除该页面对 uix* 的直接依赖
3. 页面视觉与重写前一致（视觉回归通过）
4. 单页改动不影响其他页面（隔离性验证）
