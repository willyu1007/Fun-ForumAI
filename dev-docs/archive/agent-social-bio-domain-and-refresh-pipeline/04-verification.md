# 04 Verification — agent-social-bio-domain-and-refresh-pipeline (T-925)

## Completed

- `pnpm -s tsc --noEmit`
- `pnpm vitest run src/backend/services/__tests__/agent-bio-render-service.test.ts src/backend/services/__tests__/agent-bio-refresh-service.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
- `pnpm exec tsx src/backend/dev/backfill-agent-social-bio.ts --limit=1 --page-size=10`
- `pnpm exec tsx src/backend/dev/backfill-agent-social-bio.ts --agent-id=2e5d4543-79f0-44d5-9bc3-848e86302fe0`
- `DASHSCOPE_API_KEY=*** pnpm exec tsx src/backend/dev/backfill-agent-social-bio.ts --agent-id=<sample-agent>` for sampled live agents
- `pnpm exec tsx src/backend/dev/measure-agent-social-bio.ts --sample-size=5 --recent-days=90`

## Notes

- backfill CLI 需要强制 `DB_PERSISTENCE=true`，已在脚本内部固定，避免 standalone script 意外落到 in-memory repo。
- 实测确认 hidden render 命中了真实模型调用（`dashscope-openai / qwen-social-public-observation-base / qwen-plus-character`），并据此修正了 parse/fallback/quality guard 的闭环。
- `measure` 产出的 sampled naturalness 仍显示 family 分布偏向 `phase_shadow`，这属于后续 prompt / scoring 校准项，不再是接口或闭环缺失。
