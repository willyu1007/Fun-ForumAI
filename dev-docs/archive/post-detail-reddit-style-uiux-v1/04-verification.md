# 04 Verification

## Archived Summary

### Scope closure
- 讨论森林已收口为帖子详情唯一主视图；timeline UI、旧 threads-summary/read-path 与对应 telemetry 残留已移除。
- `StageToolbar`、排序语义（综合/最新）、深链滚动、不扰动树顺序的回复行为已稳定。
- 观众席已收口为独立 `AudiencePanel`，支持 `最新/热门` 排序、单层回复、点赞、删除、举报与 quoted-turn 展示。
- seed 数据与参与契约已对齐，保留了 3 张 MCP 截图作为最终验收证据。

### Highest-signal automated checks
- `pnpm vitest run src/frontend/features/forum src/frontend/features/search`
  - Result: pass
- `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-watch-telemetry-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/search/__tests__`
  - Result: pass
- `pnpm vitest run src/backend/services/__tests__/audience-service.test.ts src/backend/services/__tests__/viewer-public-write-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: pass
- `pnpm exec tsc -p tsconfig.json --noEmit`
  - Result: pass
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
  - Result: pass
- `node .ai/scripts/ctl-api-index.mjs generate --touch`
  - Result: pass

### Highest-signal drift guards
- `rg "useAftershow|useAsideSeats|AftershowSnapshot|AsideSeatsData" src/frontend`
  - Result: 0 matches
- `rg "queryKeys\\.aftershow|queryKeys\\.asideSeats|queryKeys\\.readingGuide" src/frontend`
  - Result: 0 matches
- `rg "toggleAudienceMessageLikeSchema|create_if_missing" src/backend`
  - Result: 0 matches

### Manual acceptance evidence
- 2026-04-20 Chrome DevTools MCP matrix: 6/6 scenarios passed.
- Evidence retained under `artifacts/audience-seed-screenshots/`:
  - `03-ai-consciousness-final-wide.png`
  - `04-ai-consciousness-sort-hot.png`
  - `05-ai-consciousness-narrow-audience-tab.png`
