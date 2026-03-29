# 04 Verification

## Planned checks

- governance `sync` / `lint` 通过
- backend tests 通过
- `GET /livez` / `GET /readyz` / `GET /health` 行为符合契约
- shutdown 期间 readiness 会转为 `503`

## Execution records

- 2026-03-29:
  - governance:
    - `/opt/homebrew/Cellar/node@20/20.19.6/bin/node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> `[ok] Sync complete.`
    - `/opt/homebrew/Cellar/node@20/20.19.6/bin/node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> `[ok] Lint passed.`
  - tests:
    - `PATH=/opt/homebrew/Cellar/node@20/20.19.6/bin:$PATH /opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/vitest/vitest.mjs run src/backend/health/service.test.ts src/backend/routes/__tests__/health.test.ts src/backend/app.test.ts` -> passed (`3` files, `9` tests)
      - 覆盖 readiness TTL、drain 场景、失败日志去重、root health 状态码映射，以及 `/v1/health` 兼容包装
  - lint:
    - `PATH=/opt/homebrew/Cellar/node@20/20.19.6/bin:$PATH /opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/eslint/bin/eslint.js src/backend/health src/backend/routes/health.ts src/backend/routes/__tests__/health.test.ts src/backend/middleware/request-logger.ts src/backend/app.ts src/backend/server.ts src/backend/container/index.ts` -> passed
  - typecheck:
    - `PATH=/opt/homebrew/Cellar/node@20/20.19.6/bin:$PATH /opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/typescript/bin/tsc -b --pretty false` -> failed due pre-existing frontend dependency resolution issues:
      - `src/frontend/components/ui/hover-card.tsx`: `@radix-ui/react-hover-card` missing
      - `src/frontend/shared/components/RichTextLite.tsx`: `katex` missing
    - `PATH=/opt/homebrew/Cellar/node@20/20.19.6/bin:$PATH /opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/typescript/bin/tsc -p tsconfig.node.json --pretty false 2>&1 | rg "request-logger|middleware/request-logger"` -> no output, confirming the health-log skip patch no longer triggers the previous `req.path` typing error
  - archive cleanup:
    - `mv dev-docs/active/alb-health-readiness-upgrade dev-docs/archive/alb-health-readiness-upgrade` -> completed
    - `rm dev-docs/archive/alb-health-readiness-upgrade/01-plan.md dev-docs/archive/alb-health-readiness-upgrade/02-architecture.md dev-docs/archive/alb-health-readiness-upgrade/03-implementation-notes.md dev-docs/archive/alb-health-readiness-upgrade/roadmap.md` -> completed
    - `find . -path '*/.vitest*' -o -path '*/coverage*' -o -path '*/tmp/*health*' | head -n 100` -> no repo-local health task test artifacts found; only dependency-owned files under `node_modules/`
