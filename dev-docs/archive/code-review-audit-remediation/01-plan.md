# 01 Plan

## Phases
1. Read the audit report end to end and map each finding to the relevant repo files.
2. Validate each claim against the current implementation and separate true defects from mismatches.
3. Implement the minimal safe fixes for the verified defects.
4. Run targeted tests and record the outcomes.

## Detailed steps
- Inspect startup/bootstrap flow, auth transport paths, SSE contracts, config handling, and persistence warm-up semantics.
- Prefer fixing the contract break itself over papering over it in UI copy or docs.
- Keep changes surgical where possible; only introduce new abstractions when a bug clearly comes from missing structure.

## Risks & mitigations
- Risk: audit findings span multiple subsystems and could trigger over-broad refactors.
  - Mitigation: validate first, then only touch files tied to confirmed defects.
- Risk: auth/runtime fixes can break local development assumptions.
  - Mitigation: preserve dev paths intentionally and add explicit tests around the chosen behavior.
- Risk: startup-order changes can alter side effects in existing imports/tests.
  - Mitigation: review bootstrap boundaries before editing and verify with targeted tests.
