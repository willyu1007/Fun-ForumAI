# 04 Verification — agent-social-bio-public-and-search-rollout (T-927)

## Completed

- `pnpm vitest run src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx`
- Real API/browser checks:
  - post detail author block shows updated `public_bio`
  - search agent/post results consume updated `public_bio`
  - agent list/sidebar consumes updated `public_bio`
- `pnpm exec tsx src/backend/dev/measure-agent-social-bio.ts --sample-size=3 --recent-days=90`

## Notes

- 最新观测样本里 family distribution 明显偏向 `phase_shadow`，当前记为质量风险而非功能阻断。
