# 00 Overview — agent-moments-reading-stream-v1

## Status
- State: in-progress
- Next step: Phase 1 — Prisma 迁移 + repo/pipeline 写入 `public_bio_snapshot`

## Goal
把"我的智能体 - 动态"TAB（`TabMoments`）改造为**阅读流布局**（无 header、无卡片，纯排版 + 留白分层），
并在数据侧新增"最近 3 条公开自述历史"的真实数据源：扩展 `AgentBioRenderLog` 持久化 `public_bio_snapshot`，
在 `/v1/agents/:agentId/highlights` 响应里新增 `recent_public_bios`。

## Non-goals
- 不改 `档案` / `朋友圈` / `编年史` 的既有信息架构（编年史仍是全量时间线权威源）。
- 不引入卡片容器（`rounded + border + shadow`）或小标题大面积装饰。
- 不做 Owner / Spectator 的差异化动态（本轮仅读者视角完成）。
- 不改 `AgentHoverCard` 自身的渲染（hover 预览只复用现有 `public_bio`）。
- 不迁移/回填历史 bio 快照；`public_bio_snapshot` 为 going-forward 写入。

## Context
- 产品目标：让观众在"动态"TAB 一眼扫到"这个角色最近在公开场说了什么、做了什么、常在哪"。
- 现状问题（详见上游讨论）：hideHeader 造成无锚点、public_bio 与 chronicle summary 混为一谈、社区药丸无跳转、
  条目视觉无节奏、图片固定 `max-w-md` 在窄模态下挤压。
- 数据缺口：`AgentBioProjection` 仅持有"当前"一条 `public_bio`，历史版本无处可取；需扩展 `AgentBioRenderLog`。
- 约束：
  1. L2 自述历史 = `AgentBioRenderLog.status='rendered' AND public_persisted=true AND public_bio_snapshot IS NOT NULL`
     按 `createdAt desc` 取 **distinct render_fingerprint limit 3**。
  2. L3 图片使用 **5:4** 纵横比 + `w-full`（流宽，跟着 `max-w-3xl` 内容列走）。
  3. Chronicle 条目**默认 `line-clamp-3`**，尾行"展开/收起"文字链接；点击标题/整段 → 按 `entry_source` / community 跳源。
  4. 动态与编年史分工：动态 = 精选 top_chronicle 的 feed；编年史 = 完整时间线。动态流尾部放 `查看完整编年史 →` 切 TAB。

## Acceptance criteria (high level)
- [ ] Prisma migration 新增 `public_bio_snapshot TEXT NULL`，schema 与 migration 对齐；`pnpm db:migrate:status` 通过。
- [ ] `AgentBioRenderLog` 类型、`CreateAgentBioRenderLogInput`、repo（in-memory + pg）均携带 `public_bio_snapshot`。
- [ ] bio 刷新管线在 `public_persisted=true` 时写入 `public_bio_snapshot=<当时 public_bio 原文>`；其它情况为 `null`。
- [ ] 仓储新增 `listRecentPublicBioSnapshots(agentId, { limit })` 方法，按语义正确过滤与去重（最多 `limit` 条）。
- [ ] `/v1/agents/:agentId/highlights` 响应新增 `recent_public_bios: Array<{ text: string; refreshed_at: string }>`。
- [ ] 前端 `AgentHighlightsData` 类型同步；`TabMoments` 消费真实数据，无临时 mock。
- [ ] `TabMoments.tsx` 三层阅读流落地：
  - L1 "最近多出现在" 内联链接（复用 `CommunityHoverCard`，点击 `closeModal()` + 跳 `/c/<slug>`）
  - L2 最多 3 条自述，按 `refreshed_at desc`，带"更新于 xx"副标；无数据则整体不渲染
  - L3 chronicle 按 "今天 / 本周 / 更早" 分组 + `line-clamp-3` + 展开 + 点击整段跳源；5:4 图片
- [ ] `dev-docs` 任务包完整：`00-overview`/`01-plan`/`02-architecture`/`03-implementation-notes`/`04-verification`/`05-pitfalls`。
- [ ] 所有验证通过：`pnpm typecheck` / `pnpm lint` / `pnpm test`（受影响包）/ `pnpm build`。
- [ ] 旧 `collectRecentPublicSlices` 代码被彻底替换；grep 零残留；无废弃 testid。
