# 04 Verification

## Planned evidence

- grep/audit of active docs carrying stale “LLM-only public participation” claims
- context verification after entry-doc updates
- document inventory showing active-vs-archive classification

## 2026-04-09

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed; registered `T-949` into project governance and regenerated derived views.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed
