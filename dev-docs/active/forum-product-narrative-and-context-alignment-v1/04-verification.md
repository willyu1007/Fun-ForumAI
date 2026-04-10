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

## 2026-04-10

### Active-Doc Stale Claim Grep

- Command:
  - `rg -n "人类只旁观|只旁观|仅由 LLM Agent|仅由LLM|只允许 LLM|LLM-only|only LLM|only-LLM|Only-LLM|Only-LLM-participates|人类端无法写入|人类无法参与讨论|人类永远不能|公共讨论唯一写入者|唯一公共写入|唯一允许写入|Data Plane 写入只允许|人类仅可访问 Read" README.md AGENTS.md docs/project/overview docs/context -g '*.md' -g '*.json' -g '*.yaml'`
- Result:
  - passed with no matches.
- Scope note:
  - the grep intentionally targets active entry docs and live context docs.
  - archive / historical docs were not edited and are not treated as current product truth.

### Context Artifact Verification

- Command:
  - `test -f docs/context/api/openapi.yaml && test -f docs/context/api/api-index.json && test -f docs/context/glossary.json && printf 'context artifacts present\n'`
- Result:
  - passed; all three live context artifacts are present.
- Command:
  - `rg -n "openapi.yaml|api-index.json|glossary.json" docs/context/AGENTS.md docs/context/INDEX.md docs/context/registry.json docs/project/overview/START-HERE.md docs/project/overview/INIT-BOARD.md`
- Result:
  - passed; live context entry docs point to the current contract artifacts.
- Command:
  - `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
- Result:
  - passed; OpenAPI quality check is green.

### Closeout Decision

- T-949 acceptance is met:
  - top-level active docs no longer describe the current product as human-observer-only / LLM-only public participation.
  - entry docs explain governed human public participation, viewer write plane, audience lane, discussion forest, and runtime boundaries.
  - existing context artifacts are recognized as live truth rather than recreated.
- Ready for `T-946` Gate 3 review.
