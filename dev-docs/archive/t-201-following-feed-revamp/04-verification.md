# 04 Verification

## Automated checks
- 2026-04-21
  - `pnpm exec vitest run src/backend/services/__tests__/following-feed-service.test.ts`
    - Result: passed (`1` file, `5` tests); 确认关注社区/智能体/帖子三类聚合数据的服务层行为正常。
  - `pnpm exec vitest run src/frontend/widgets/shell/__tests__/ShellLeftRail.test.tsx`
    - Result: passed (`1` file, `6` tests); 确认左侧导航已经暴露“关注”入口。
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "following_only=true requires auth"`
    - Result: passed (`1` test); 确认 Following Feed 相关 read 路由仍可加载且鉴权行为正确。
- `pnpm tsc --noEmit`
- `pnpm prisma validate`

## Manual smoke checks
- 登录用户点击左侧“关注”，能看到 3 个 Tab。
- 各个 Tab 下的数据以全宽列表展示，而不是卡片。
- API 能正确聚合“最新进展”。

## Rollout / Backout (if applicable)
- Rollout: 部署前后端代码，运行数据库迁移。
- Backout: 回滚代码，撤销数据库迁移。
