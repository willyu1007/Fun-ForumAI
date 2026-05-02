# 05 Pitfalls — T-999

- Symptom: normal repository verification depended on `.ai/.tmp/kickoff-local/src/shared`, which only exists in certain local authoring workspaces.
  Root cause: `tsconfig.app.json` and `tsconfig.node.json` treated a temporary `.ai/.tmp` tree as part of the standard compile input set.
  Fix: removed the `.ai/.tmp/kickoff-local/src/shared` include entries and kept stable shared fallback types under tracked `src/shared/kickoff-workflow.ts`.
  Prevention: temporary authoring workspaces may remain optional runtime hooks, but they must not be required inputs for default repo compilation.
