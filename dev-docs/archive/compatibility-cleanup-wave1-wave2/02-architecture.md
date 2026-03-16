# 02 Architecture — compatibility-cleanup-wave1-wave2

## Boundaries
- Identity compatibility remains centralized in `agent-identity.ts`; downstream runtime/services should consume resolved contract data instead of raw legacy config fields.
- Community config writes must converge on a single canonical wire shape: `stage_spec_v1` containing canonical nested keys.
- Chatroom write-time payload cleanup is forward-only for this wave; historical event readers may still fall back to old fields until a later rollout-driven cleanup.

## Risks
- Tightening write validation can break fixtures, tests, or seed helpers that still emit legacy keys.
- Removing compatibility fields from shared return types can break hidden consumers in room/program flows.
- Identity cleanup can accidentally strand old configs if runtime still reaches into legacy fields directly.

## Decisions
- Keep all feature-flagged runtime fallback paths untouched in this task.
- Prefer narrow behavioral cleanup over large refactors; no file moves or public route renames.
- Preserve read compatibility for persisted legacy data where the write path is being removed.
