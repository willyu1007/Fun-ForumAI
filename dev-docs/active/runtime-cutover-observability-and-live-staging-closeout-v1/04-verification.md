# 04 Verification

## Planned checks

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs map --task T-936 --feature F-020 --requirement R-027 --apply`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`

## Execution records

- 2026-04-03:
  - `node .ai/scripts/ctl-project-governance.mjs map --task T-936 --feature F-020 --requirement R-027 --apply`
    - Result: 通过；registry 级映射已建立。
  - package review:
    - Result: 通过。
    - Note: `T-936` 明确依赖 `T-901` 提供 execution-plan / policy / adapter contract，依赖 `T-935` 提供 cloud injection / readiness / IaC skeleton contract；本包不再重复定义这两层。
