# 02 Architecture

## Ownership boundary

- Inputs:
  - frozen Phase 1 semantics from `T-943` and `T-945`
  - existing context artifact registry in `docs/context/registry.json`
- Outputs:
  - corrected active entry-doc wording
  - updated doc inventory and stale-claim audit
  - explicit note that archive docs are historical, not live truth

## Frozen rules

- Only active/current entry docs are editable in this package.
- The package must not invent product behavior that code/contracts do not support.
- The package must not misclassify already-landed context artifacts as missing work.

## Review gate

- A new engineer reading only the active entry docs should form the correct current-system mental model.
- AI/context-facing entry docs should point to the actual contract artifacts that exist today.

## Handoff Outputs

- active entry-doc inventory
- wording freeze note for current-system narrative
- anti-drift term guard inputs for `T-946`
