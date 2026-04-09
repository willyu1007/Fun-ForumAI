# 04 Verification

## Planned evidence

- broker unit/integration tests covering old-branch revive and audience spike
- recall-policy tests covering same pair across different threads
- decision telemetry snapshots showing decay and scope behavior
- metric dictionary / dashboard-spec note for spontaneity, branch entropy, and duel risk

## 2026-04-09

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed; registered `T-947` into project governance and regenerated derived views.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed
