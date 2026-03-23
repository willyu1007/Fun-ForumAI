# 04 Verification

## Key Checks
- `pnpm prisma migrate dev` — migration 成功
- `pnpm prisma generate` — client 生成
- `pnpm tsc --noEmit` — 零 TypeScript 错误
- `pnpm lint` — 零 lint 回归
- `pnpm prisma migrate dev --name add-growth-budget-chat-models` — documented automated check
- `pnpm prisma generate` — documented automated check

## Coverage
- Automated checks
- Phase 1 — Schema + Migration
- Phase 2 — Pg Repository
- Phase 3 — Agent Dashboard
- Browser 手动验证
