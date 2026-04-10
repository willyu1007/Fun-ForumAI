# 04 Verification

## Automated checks
- 已完成基线审查（修复前）：
  - `pnpm typecheck` -> failed
  - `pnpm lint` -> failed
  - `pnpm test` -> failed
  - `pnpm build` -> passed
  - `pnpm ui:check` -> passed
  - `pnpm ui:bundle:check` -> failed
  - `pnpm db:validate` -> passed
  - `pnpm verify:launch:ci` -> failed
  - `pnpm mobile:typecheck` -> passed
  - `pnpm mobile:test` -> passed
  - `pnpm mobile:config:check` -> passed
  - `pnpm mobile:smoke:validate` -> passed
  - `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate --build-profile launch` -> passed

- 修复后定向验证：
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts` -> passed
  - `pnpm exec vitest run src/backend/services/__tests__/media-asset-control-service.test.ts` -> passed
  - `pnpm exec vitest run src/backend/services/__tests__/public-observation-real-smoke.test.ts src/backend/services/__tests__/semantic-projection-service.test.ts` -> passed
  - `pnpm exec vitest run src/frontend/app/__tests__/lazy-import-recovery.test.ts src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/user/pages/__tests__/FeedbackPage.test.tsx` -> passed
  - `pnpm exec vitest run src/frontend/widgets/agent-modal/__tests__/AgentInteractionModal.test.tsx src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx` -> passed
  - `pnpm exec playwright test tests/web/playwright/forum-orchestration.e2e.spec.ts --project=desktop-light` -> passed (`2` passed)
  - `pnpm exec playwright test tests/web/playwright/agent-modal.visual.spec.ts --update-snapshots` -> passed (`30` passed)
  - `pnpm exec playwright test tests/web/playwright/forum-p0.visual.spec.ts tests/web/playwright/governance-auth.visual.spec.ts tests/web/playwright/realtime-p0.visual.spec.ts --update-snapshots` -> passed (`60` passed)
  - `pnpm typecheck` -> passed
  - `pnpm lint` -> passed with warnings only (`react-refresh/only-export-components` in `src/frontend/app/route-components.tsx`)
  - `pnpm test` -> 首次并发重跑时因 `ui:build` 读到中间产物而失败；串行重跑后 passed (`327` files / `1682` tests)
  - `pnpm ui:check` -> passed
  - `pnpm db:validate` -> passed
  - `pnpm mobile:typecheck` -> passed
  - `pnpm mobile:test` -> passed
  - `pnpm mobile:config:check` -> passed
  - `pnpm mobile:smoke:validate` -> passed
  - `pnpm build` -> passed
  - `pnpm ui:bundle:check` -> passed（`vendor` 降到 `197.06 kB`，低于历史最大块基线）
  - `pnpm verify:launch:ci` -> passed (`18/18`)
  - `pnpm test:e2e:playwright` -> passed (`102` passed)
  - `node ops/packaging/scripts/build.mjs --target llm-forum --tag llm-forum:ci-validate --build-profile launch` -> passed
  - `node .ai/skills/features/ci/scripts/ci-verify.mjs --suite perf-k6-smoke` -> skipped（仓库未定义 `test:perf:k6`，已改为显式 skip）

- CI/profile 验证补充：
  - `node .ai/skills/features/ci/scripts/ci-verify.mjs --profile pr-gate`
    - 初次失败：`api` suite 硬编码 `pnpm test:api`
    - 修复后 `api` 可回退到 `pnpm test`
    - `api-context` 的语义校验、索引重建、context verify 全部 passed
    - `api-context` 最后的 `git diff --exit-code docs/context/api/api-index.json docs/context/api/API-INDEX.md docs/context/registry.json` 在本地未提交工作树中仍会报差异；这三份生成物已刷新到当前 OpenAPI 状态
  - `node .ai/skills/features/ci/scripts/ci-verify.mjs --suite web-playwright`
    - 浏览器安装完成后执行
    - 首轮 failed: `94` failed / `8` passed（`1.6m`）
    - 首轮失败主要集中在：
      - `tests/web/playwright/agent-modal.visual.spec.ts`
      - `tests/web/playwright/forum-orchestration.e2e.spec.ts`
      - `tests/web/playwright/governance-auth.visual.spec.ts`
      - `tests/web/playwright/realtime-p0.visual.spec.ts`
      - 桌面/平板/移动多 viewport 视觉基线
    - 收敛过程：
      - 修复 forum 读模型缺失 `lifecycle` 时的前端空指针
      - 修复 `agent-modal` owner tab 的误定位
      - 抽样确认当前 UI 后刷新对应视觉基线
    - 最终 `pnpm test:e2e:playwright` 全量 passed：`102` passed
    - 首轮失败产物位于 `artifacts/playwright/test-results/`

## Manual smoke checks
- 暂无；本任务以自动化回归收敛为主。

## Rollout / Backout (if applicable)
- Rollout:
  - 修复后重跑同一组仓级校验。
- Backout:
  - 若某项 fallback 引入行为回归，回退对应 service 变更并保留独立修复提交颗粒度。

## 2026-04-10 Repo-wide legacy/debt review revalidation

- `pnpm exec vitest run src/backend/services/__tests__/forum-read-service.test.ts` -> passed (`32` passed)
- `pnpm lint` -> passed (`0` errors, `0` warnings)
- `pnpm exec tsc --noEmit` -> passed
- `git diff --check` -> passed
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` -> passed (`[ok]`)
- `node .ai/scripts/ctl-api-index.mjs generate --touch` -> passed
- `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs touch` -> passed
- `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs verify --strict` -> passed
- `rg -n "rule-registry|prisma-singleton|legacy_thread_excerpt" src docs/context -g '*.ts' -g '*.tsx' -g '*.yaml'` -> no matches
- `rg -n "Only-LLM-participates|human observe only|人类只旁观|纯 LLM-only|LLM-only public participation|only-LLM|人类端无法写入|人类无法参与讨论|公共讨论唯一写入者|唯一公共写入|Data Plane 写入只允许|人类仅可访问 Read" README.md AGENTS.md package.json docs/project/overview docs/context -g '*.md' -g '*.json' -g '*.yaml'` -> no matches
- `rg -n "\\bcan_receive_replies\\b|targetThreadTurn|/posts/:postId/public-threads|/threads/:threadId/public-turns|/posts/:postId/audience-messages|/viewer/posts/:postId/public-threads|/viewer/threads/:threadId/public-turns|/viewer/posts/:postId/audience-messages" src/backend src/frontend src/shared -g '*.ts' -g '*.tsx'` -> remaining matches limited to:
  - shared/backend compat bridge fields (`can_receive_replies`, `targetThreadTurn`)
  - backend compat wrappers in `read-api.ts`
  - canonical `/viewer/*` routes in `viewer-write-api.ts`
  - tests
