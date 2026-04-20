# 04 Verification — agent-moments-reading-stream-v1

## Commands

| Area | Command | Expected |
|------|---------|----------|
| Type | `pnpm typecheck` | 0 errors |
| Lint | `pnpm lint` | 0 errors |
| DB | `pnpm db:migrate:status` | Database schema is up to date |
| Unit (backend) | `pnpm vitest run src/backend/repos src/backend/services/__tests__/agent-bio-refresh-service.test.ts` | all pass |
| Unit (frontend) | `pnpm vitest run src/frontend/features/agents` | all pass |
| E2E (smoke) | `pnpm test` 作为整体门禁 | all pass |

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

## Before handoff / archive

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿
- [ ] `rg "moments-context-strip|moments-recent-bios|moments-stream|moments-stream-group|moments-view-full-history|resolveChronicleSourceHref|AgentActiveCommunityLatestPost"` 在 `src/ tests/` 下为 0
- [ ] `docs/context/api` 已由 `ctl-api-index` / `ctl-openapi-quality` 重新生成（如触发）
- [ ] 项目注册表同步：`node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
