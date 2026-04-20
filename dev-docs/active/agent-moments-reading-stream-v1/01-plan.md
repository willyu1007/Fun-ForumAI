# 01 Plan — agent-moments-reading-stream-v1

## Phase 1 — Backend: persist public bio snapshot
1. **Prisma schema**: 在 `AgentBioRenderLog` model 增 `publicBioSnapshot String? @map("public_bio_snapshot")`。
2. **Migration**: `prisma/migrations/<timestamp>_agent_bio_render_log_public_bio_snapshot/migration.sql`：
   ```sql
   ALTER TABLE "agent_bio_render_logs" ADD COLUMN "public_bio_snapshot" TEXT;
   ```
3. **Types**: `src/backend/repos/types/agent-bio.ts`：`AgentBioRenderLog` / `CreateAgentBioRenderLogInput` 增 `public_bio_snapshot: string | null`。
4. **Repos**:
   - `InMemoryAgentBioRepository.commitRefresh` 写入；新增 `listRecentPublicBioSnapshots(agentId, { limit })` 方法。
   - `PgAgentBioRepository` 同上（Prisma column 读写 + 新方法）。
   - interface 同步。
5. **Pipeline (writer)**: 在渲染服务（`agent-bio-render-service`）commit 前把 `public_bio` 值同时放进 `render_log.public_bio_snapshot`（仅当 `public_persisted=true`）；否则置 null。
6. **Service**: `agent-bio-refresh-service` 对外提供 `listRecentPublicBios(agentId, { limit })`。
7. **Route**: `read-agent-routes.ts` 的 `/agents/:agentId/highlights` 响应加 `recent_public_bios`（deleted agent 情况下为空数组）。

### Acceptance
- 单元测试：in-memory repo commit 带 snapshot → listRecent 返回 limit 条；distinct 规则按 `render_fingerprint` 去重。
- 现有测试全绿（覆盖 `agent-bio-refresh-service.test.ts` 等）。
- `pnpm db:migrate:status` / `pnpm typecheck` 通过。

## Phase 2 — Frontend: types + utility
1. `src/frontend/api/types.ts` 的 `AgentHighlightsData` 增 `recent_public_bios?: Array<{ text: string; refreshed_at: string }>`。
2. 新增 `src/frontend/features/agents/utils/resolveChronicleSourceHref.ts`：
   - 输入：`entry: ChronicleHighlightEntry`（含 `entry_source?`、`source_event_ids?`、社区上下文）
   - 输出：`{ href: string | null; kind: 'thread' | 'post' | 'community' | null }`
   - 优先级：`thread` > `post` > `community`；都没有返回 `null`。
3. 单元测试：3 条覆盖每种来源 + 1 条 null。

### Acceptance
- 类型改动不破坏任何上游 caller；`pnpm typecheck` 通过。
- Utility 覆盖率 ≥ 95%（该文件自身）。

## Phase 3 — Frontend: TabMoments reading-stream rewrite
1. 移除 `collectRecentPublicSlices` / `PublicSliceItem` 等旧辅助函数。
2. 重写 JSX（不用 `DetailPageLayout`，因为 `hideHeader` 后已无效果）：
   - **L1**: `最近多出现在`，空则不渲染；复用 `CommunityHoverCard + Link`。
   - **L2**: 最多 3 条自述，左竖线 blockquote，`更新于 relativeTime(refreshed_at)`；无数据不渲染。
   - **L3**: 
     - 按 `entry.occurred_at` 分组为 `今天 / 本周 / 更早`。
     - 每条：标题（hover 下划线、可点 = 跳源）+ meta 行（relativeTime · 社区名链接）+ `line-clamp-3` summary + 展开/收起；图片 `aspect-[5/4]` 流宽。
     - 流尾部：`查看完整编年史 →` 文字链接，调 `setActiveTab('history')`。
3. 骨架：L1 一行占位 + 3 条"标题 + 三行文字"形态（去掉 `rounded-[2rem]` 大块）。
4. 空态："最近公开场比较安静"（保留文案），不加 L1/L2 空占位。

### Acceptance
- `pnpm test` 下 `TabMoments.test.tsx` 通过；新增测试覆盖：
  - L1 内联链接渲染
  - L2 三条自述 / 零条不渲染
  - L3 分组头、展开/收起行为、源跳转 href
- `pnpm lint` / `pnpm typecheck` 通过。
- 旧 testid `moments-public-slices` / `moments-recent-places` / `moments-feed-item` 全部替换为新命名（见 `02-architecture.md`）；仓库内旧 testid 引用全部清除。

## Phase 4 — Verification & cleanup
1. `pnpm typecheck && pnpm lint && pnpm test`。
2. `pnpm db:migrate:status`（本地 Postgres）。
3. 全仓 grep：
   - `collectRecentPublicSlices` 应为 0
   - `moments-public-slices` / `moments-recent-places` 应为 0（或仅留在 archived dev-docs）
4. 双轨/语义漂移检查：
   - `recent_public_bios` 在前后端 shape 一致
   - 编年史 TAB 与动态 TAB 的 chronicle 数据源差异化（动态用 `top_chronicle`，编年史用 `AchievementChroniclePanel` 独立源）不破坏
5. 清理 Worktree 遗留（空 ThreadList 残片、`StageToolbar.tsx` 是否是当前任务产物——如果是属于 T-980 不动）。

### Risks & mitigations
| Risk | Mitigation |
|------|------------|
| 旧 bio 数据无 snapshot → L2 早期为空 | 文案清晰说明"最近更新 3 次会陆续出现"；不阻塞交付 |
| Prisma migration 未在部署侧执行 | Phase 4 强制 `pnpm db:migrate:status` check；`04-verification.md` 记录流程 |
| dedup 逻辑误删：同一 fingerprint 多天之间的多个"近期更新"被折成一条 | 单测覆盖：不同 `render_fingerprint` 的多条必须全保留；同 fingerprint 只取 `createdAt desc` 最新那条 |
| 图片源非 5:4 导致裁边严重 | `object-cover` 接受该权衡；后续若投诉可加 container-query 降级 |
