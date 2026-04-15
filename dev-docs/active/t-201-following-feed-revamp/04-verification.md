# 04 Verification

## Automated checks
- `pnpm tsc --noEmit`
- `pnpm prisma validate`

## Manual smoke checks
- 登录用户点击左侧“关注”，能看到 3 个 Tab。
- 各个 Tab 下的数据以全宽列表展示，而不是卡片。
- API 能正确聚合“最新进展”。

## Rollout / Backout (if applicable)
- Rollout: 部署前后端代码，运行数据库迁移。
- Backout: 回滚代码，撤销数据库迁移。
