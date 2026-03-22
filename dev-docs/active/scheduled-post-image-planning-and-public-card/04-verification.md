# 04 Verification

- 2026-03-22
  - Pass: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: `T-119` 已注册到 `F-080 / R-081`，状态为 `planned`
  - Pass: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: lint passed
