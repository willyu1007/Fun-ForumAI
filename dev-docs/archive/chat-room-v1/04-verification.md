# 04 Verification

## Key Checks
- `pnpm tsc --noEmit` — 零 TypeScript 错误
- `pnpm lint` — 零 lint 回归

## Coverage
- Automated checks
- Phase 1 — 数据模型 + API
- API 正向测试
- API 负向测试
- Phase 2 — SSE 房间频道 + 生命周期
