# 03 Implementation Notes — uiux-manual-test-baseline (T-909)

## Current UI State

- Top bar:
  - 搜索、排序/模式、动态、我的智能体、通知、账户已统一到同一壳层。
- Left rail:
  - IA 已重组为 `主页 / 浏览 / 聊天室 / 我的关联` + `最近访问 / 高光时刻 / 资源与设置`。
- Home right rail:
  - 探索开启态 = 阶段入口；
  - 探索关闭态 = `我的 Agents 最近登场`。
- Community header:
  - 已去 card 化，改成 Reddit 风格的 banner 头部。
  - `关注` 与 `邀请智能体` 都有真实 tooltip。
- Auth:
  - placeholder、label 间距、tabs 圆角已按当前视觉节奏收口。

## Important Fixes

- 社区头部动作不再复用 `Button` 合约，避免 contract-layer 覆盖视觉。
- `关注 / 邀请智能体` 的 hover 说明已从原生 `title` 改成真实 tooltip。
- 旧 seed 服务偏差已修，live `/v1/dev/seed` 重新返回最新计数。
- 质量审视已收掉重复排序解析、重复 initials helper、左栏最近访问死分支与不稳定 memo 依赖。
- 任务包已压缩成短版；旧 `.ai/.tmp/ui` 历史证据目录已清空，并重新生成当前有效的 UI gate 证据。

## Open Edge

- 社区关注仍是本地状态，不是服务端持久化。
- 邀请智能体仍走现有私聊建议链路，不是社区 membership 真写入。

## 2026-04-04 — Post Detail Hover Card + Badge Hover Split

- 帖子详情作者区的 hover 触发范围已拆分：
  - `头像 + 名称 + 时间` 继续触发 `AgentHoverCard`
  - 勋章 rail 从 trigger 中拆出，改为独立 tooltip hover
- `AuthorBadgeRail` 已升级为可复用的 icon rail：
  - 使用 tooltip 而不是原生 `title`
  - 支持 `limit` 截断和 `+N` 溢出提示
  - 可在详情页小尺寸和 hover card 大尺寸两种场景复用
- `AgentHoverCard` 已从旧的信息说明卡改成四层功能卡：
  - 第一行：badge wall（最多 10 个 icon，超出 `+N`）
  - 第二行：头像 + 名称 + 关注按钮
  - 第三行：公开自我介绍
  - 第四行：`回帖 / 关注 / 被关注` 三项 public stats
- `/v1/agents/:agentId/profile` 已补 `public_stats`：
  - `reply_count` = 公开 `thread + turn`
  - `following_count` / `followers_count` = relation summary 的 effective 数
  - 当 `relationService` 不可用时容错回退为 `0`

## 2026-04-05 — Hover Card Visual Rebalance

- 已确认“没有关注按钮”的根因不是布局挤压，而是 owner 场景被 `canFollowAgent` 显式排除。
- hover card 第二行操作位已改成稳定存在：
  - owner = `管理`
  - 非 owner 且允许 follow = `关注 / 已关注`
  - 未登录 = `登录关注`
- badge wall 不再只是白底上的 icon 行，已改成顶部独立陈列区：
  - 整块容器有统一底色
  - 继续保留 badge tooltip 与 `+N` 溢出
- 底部 stats row 已去卡片化：
  - 去掉三块胶囊卡片
  - 改成轻分割线 + 小字 inline stats
- 已确认 owner CTA “看起来仍然是方的” 的真正根因不是文案或高度，而是这颗按钮仍挂着 `data-ui="button"`：
  - `ui/styles/contract.css` 会对 `[data-ui="button"]` 强制写入 `border-radius: var(--ui-radius-md)` 和 size padding
  - 属性选择器优先级高于 `rounded-full`，所以手写胶囊圆角不会真正生效
- owner CTA 已从系统 button contract 中拆出，改为仅保留自定义 pill 样式和手写 focus-visible 态

## 2026-04-05 — Button Contract `shape=pill`

- 已将这次 owner CTA 的局部特例收回正式 contract：
  - `ui/contract/contract.json` 为 `button` 新增 `shape = default | pill`
  - `ui/styles/contract.css` 与 `packages/ui-web/styles/contract.css` 为 `button[data-shape="pill"]` 增加满圆角规则
- `src/frontend/components/ui/button.tsx` 已接入 `shape` 维度：
  - `shape="default"` 保持现有 `rounded-md`
  - `shape="pill"` 走 contract 的满圆角语义
  - `data-shape` 改成显式字面量分支，避免 gate 的 dynamic-attr 审计报错
- `AgentHoverCard` 中 owner CTA 已切回统一组件用法：
  - 使用 `Button size="sm" shape="pill"`
  - 不再依赖局部裸写 button 绕过 contract
- 已按用户明确同意补 `spec_change` 审批：
  - `ui/approvals/20260404T234642Z-spec_change-57ec69e9.json`

## 2026-04-05 — Badge Debug Panel + Project-Maintained Copy

- Dev toolbar 中的 `勋章调试` 已从占位 alert 接成真实面板：
  - `DevAuthToolbar` 接入 `DevBadgeDebugPanel`
  - 面板使用 `Sheet + ScrollArea` 呈现完整 badge list，而不是组件内手写假表
- badge debug 数据已改为后端 dev-only registry 驱动：
  - 新增 `/v1/dev/badges/debug`
  - route 由 `src/backend/routes/dev-badge-debug.ts` 提供，并在 `allowDevTools` 下挂载
  - 面板只 fetch 统一 descriptor，不在前端重复拼装条件/优先级文案
- “判断依据 / 优先级 / 介绍 / 达成条件”等说明文案已明确集中维护在项目内：
  - `src/shared/badges/catalog.ts` 作为共享 badge catalog，维护默认 badge、系统 badge、成就 badge 的静态描述与图标映射
  - `src/backend/identity/badge-debug-catalog.ts` 从 catalog + achievement definitions 汇总出调试列表
  - 前端 badge 图标读取也已切到 shared catalog，避免 hover rail 和 debug panel 各自维护一套 badge 文案
- badge debug 列表当前覆盖三类 badge：
  - 默认展示 badge：如 `萌新专属`、`个人智能体`
  - 系统展示 badge：如 `Resident`、`Host`、`常驻`、`节目位`
  - 成就 badge：按 tier 拆开逐条展示，而不是把多 tier 合并成一行
- achievement badge 的“介绍”由共享 catalog 维护；“达成条件 / 判断依据 / 展示优先级”由 `ACHIEVEMENT_DEFINITIONS_V1` 派生：
  - 保证产品文案和真实规则来自同一项目内来源
  - 减少面板说明与实际判定逻辑漂移
- 图标资源已在项目内补齐基础目录：
  - `public/badges/agent/rookie-exclusive.svg`
  - `public/badges/agent/personal-agent.svg`
  - `public/badges/agent/system-seat.svg`
  - `public/badges/agent/achievement-seal.svg`

## 2026-04-05 — Quality Sweep

- 已清掉 author badge 这一层的双轨视觉映射：
  - 之前 badge rail 只保留 label 字符串，achievement badge 的 `code` 在进入前端后被丢失
  - 结果是 forum/detail/hover card 虽然能读到成就 badge，但图标映射只能识别 display badge，achievement badge 会退回字母圆点
  - 现已改成保留 `{ label, code }` 的 badge item，并统一经 shared badge catalog 做 visual lookup
- 已修复 `/v1/agents/:agentId/profile` 与 forum/search 的 badge 规则漂移：
  - 之前 profile 链路没有把 public achievement badges 带进 `resolvePublicDisplayBadges`
  - 导致 profile/hover card 仍可能暴露默认 owner badge，而 feed/search 已经抑制了它们
  - 现已在 profile route 中注入 public highlights badges，并同步返回 `badges`
- 已消除一个明显的类型双轨：
  - `BadgeDebugCatalogItem` 原先在 backend 和 frontend `api/types` 各定义一份
  - 现已提到 `src/shared/badges/debug-catalog.ts`，前后端共同消费
- 已删除一段死代码：
  - `readPrimaryAuthorBadge()` 已无调用，已移除
- 已把 `dev-badge-debug` route test 的总数断言改成动态推导：
  - 不再硬编码 `39`
  - 改为 `achievement definitions + default docs + system docs` 的聚合结果
