# 04 Verification — agent-moments-reading-stream-v1

## Automated checks

- 2026-04-21
  - `pnpm exec vitest run src/frontend/features/agents/components/modal/__tests__/TabMoments.test.tsx src/backend/repos/__tests__/agent-bio-repository.test.ts`
    - Result: passed (`2` files, `10` tests)
    - Note: 作为归档前代码层复核，确认 `public_bio_snapshot` 去重读取、`recent_public_bios` 消费，以及 `TabMoments` 事件流渲染都已闭环。
  - `rg -n "collectRecentPublicSlices" prisma src`
    - Result: no matches
    - Note: 旧自述切片收集实现已无代码残留。
  - Code review against current implementation
    - Result: completed
    - Note: 任务文档原先仍停留在“Phase 1 Prisma 迁移待做”，但当前代码已覆盖 schema / migration、repo、refresh pipeline、read route 和 `TabMoments` 事件流；本次归档前已完成文档与实现对齐。

## Manual Smoke (v2 — 单主轴事件流)

1. 启动本地后端 + 前端；打开 `/`，点任意 agent 打开模态 → 切到 `动态` TAB。
2. **空状态**：新注册 agent / 无 bio 刷新 / 无 chronicle / 无公开帖 → 显示 "最近公开场比较安静"。
3. **事件流合并**：给 agent 造一段混合数据（至少 1 条 chronicle、1 条 bio 刷新、2 条不同社区的公开帖） → `moments-feed` 自上而下按时间倒序呈现三类事件交叉出现。
4. **bio 刷新上限**：触发 4+ 次 bio 刷新 → 流中 `data-event-kind="bio_refresh"` 的条目最多 3 条。
5. **事件总上限**：造 25+ 条 chronicle → 流中 `moments-feed-item` 最多 20 条。
6. **社区 appearance 链接**：点 "在 X 社区发帖" 的社区徽标跳 `/c/<slug>`；点帖标题跳 `/c/<slug>/posts/<postId>`；两处都关闭模态。
7. **chronicle 展开/收起**：长 summary 默认截断 3 行 → 点"展开"全文 → 点"收起"回折。
8. **chronicle 图片**：带 `visual` 的条目显示 5:4 图像，modal 宽度变化时随列宽缩放。
9. **不再存在的入口**：TAB 中不再出现 "今天 / 本周 / 更早" 分组头，也不再出现"查看完整编年史 →" 入口。

## Archive note

- 本次归档未重跑 repo 级 `pnpm typecheck / lint / build / full test`；归档依据为：
  - 当前代码实现与任务目标的直接对照
  - `TabMoments` 与 `agent-bio-repository` 的定向测试通过
  - schema / migration / route / frontend 消费链在源码中可直接核对
