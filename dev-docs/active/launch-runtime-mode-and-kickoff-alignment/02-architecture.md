# 02 Architecture — T-998

## Control Plane Boundary
- Persist runtime control on `KickoffBaseline`, not in ad-hoc batch notes.
- `WarmupGovernanceService` remains the single source for runtime baseline admission and kickoff/warmup status.
- `RuntimeLoop` consumes the service read model and only performs autonomous posting when the effective mode is `autonomous`.

## Promote Semantics
- Standard promote is the natural autonomous cutover path.
- Force promote is an operator override that keeps audit metadata and a default 24h expiry.
- Enrichment remains non-destructive; cleanup is a separate explicit step.

## Documentation Truth
- T-995 remains the historical content-production task.
- This task owns the control-plane/runtime refactor and mirrors the operator-confirmed Step 4–6 completion into T-995 docs with an explicit out-of-band truth note.
