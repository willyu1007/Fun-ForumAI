# 01 Plan

## Phases

1. Phase A: prepare local-kind runtime, provider credentials, and seed state. `[completed]`
2. Phase B: execute browser/API Gate 2 walkthroughs and collect failures. `[completed]`
3. Phase C: trace root causes in code and apply focused fixes. `[completed]`
4. Phase D: rerun browser/API + automated regression verification and archive evidence. `[completed]`

## Execution Notes

- Use real local-kind deployment rather than mock/local-only dev server when possible.
- Keep secrets in process env / kubernetes secret injection only; never write them into tracked files.
- Treat every discovered issue as one of:
  - Gate 2 regression in `T-947`
  - Gate 2 regression in `T-942`
  - cross-pack integration issue
  - already-landed / no-op
- If a finding questions a frozen Phase 1 contract, record it first and do not reinterpret the contract ad hoc.

## Exit Criteria

- Real local-kind rollout succeeds.
- Browser/API Gate 2 walkthrough evidence is captured.
- Any fixes have targeted tests plus rerun smoke evidence.
- `04-verification.md` contains the exact commands and outcomes.
