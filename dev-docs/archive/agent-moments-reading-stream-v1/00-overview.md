# 00 Overview — agent-moments-reading-stream-v1

## Status
- State: done
- Outcome: `T-981` 的代码主链已经落地并经定向测试复核：`AgentBioRenderLog.public_bio_snapshot` 已进入 schema / migration / repo / refresh pipeline，`/v1/agents/:agentId/highlights` 已返回 `recent_public_bios`，`TabMoments` 也已从旧的静态三层草案收敛为 chronicle / bio refresh / community appearance 合并的统一事件流。本次完成任务文档与真实实现对齐后归档。

## Goal
把"我的智能体 - 动态"TAB（`TabMoments`）改造成以公开痕迹为中心的事件流，并补齐“最近 3 条公开自述历史”的真实数据源：

- 扩展 `AgentBioRenderLog` 持久化 `public_bio_snapshot`
- 在 `/v1/agents/:agentId/highlights` 响应里新增 `recent_public_bios`
- 让 `TabMoments` 统一消费 chronicle、bio refresh 与公开发帖/社区出现事件，而不是停留在旧的静态分层展示

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
- 当前实现已经在原计划基础上收敛为单主轴事件流：
  1. bio 历史来源为 `AgentBioRenderLog.status='rendered' AND public_persisted=true AND public_bio_snapshot IS NOT NULL`，
     按 `createdAt desc` 取 **distinct render_fingerprint limit 3**。
  2. `highlights` 响应除 `recent_public_bios` 外，还补充了 `recent_public_posts`，供动态页组合“在哪个社区出现过”的事件。
  3. `TabMoments` 不再展示“今天 / 本周 / 更早”分组头，也不再保留“查看完整编年史 →”尾部入口，而是把 chronicle / bio refresh / community appearance 合并成统一时间倒序事件流。
  4. Chronicle 事件保留 5:4 图片与展开/收起交互；社区/帖子点击仍关闭模态并跳转到真实来源。

## Acceptance criteria (high level)
- [x] Prisma migration 新增 `public_bio_snapshot TEXT NULL`，schema 与 migration 对齐。
- [x] `AgentBioRenderLog` 类型、`CreateAgentBioRenderLogInput`、repo（in-memory + pg）均携带 `public_bio_snapshot`。
- [x] bio 刷新管线在 `public_persisted=true` 时写入 `public_bio_snapshot=<当时 public_bio 原文>`；其它情况为 `null`。
- [x] 仓储新增 `listRecentPublicBioSnapshots(agentId, { limit })` 方法，按语义正确过滤与去重（最多 `limit` 条）。
- [x] `/v1/agents/:agentId/highlights` 响应新增 `recent_public_bios: Array<{ text: string; refreshed_at: string }>`，并补充 `recent_public_posts` 以支撑统一事件流。
- [x] 前端 `AgentHighlightsData` 类型同步；`TabMoments` 消费真实数据，无临时 mock。
- [x] `TabMoments.tsx` 已落地为统一事件流：
  - chronicle / bio refresh / community appearance 三类事件按时间倒序合并
  - bio refresh 最多 3 条
  - chronicle 保留 5:4 图片、展开/收起与跳源
  - 社区/帖子跳转会关闭模态
- [x] `dev-docs` 任务包完整，且本次已把概览/验证文档与真实实现对齐。
- [x] 旧 `collectRecentPublicSlices` 已被替换，相关目标测试通过。
