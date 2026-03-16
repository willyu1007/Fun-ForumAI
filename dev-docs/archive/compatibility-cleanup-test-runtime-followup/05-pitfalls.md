# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Do not delete a “legacy/rollout” test just because the name looks old; first confirm whether the runtime code behind it is still live.

## Pitfall log (append-only)

### 2026-03-16 - Removed the wrong contract tail first
- Symptom:
  - `pnpm typecheck` failed after deleting the prompt-profile fallback path.
- Context:
  - The community prompt-profile contract no longer used a `fallback` flag, but downstream audit/observation types still referenced it.
- What we tried:
  - Deleted the runtime branch and updated the primary tests first.
- Why it failed (or current hypothesis):
  - The compatibility field was duplicated in `PromptComposeAudit` and `persona-observation` normalization, so removing only the producer left stale consumers behind.
- Fix / workaround (if any):
  - Removed the `fallback` field from the shared audit type and the persona-observation normalization path, then reran typecheck and targeted tests.
- Prevention (how to avoid repeating it):
  - When deleting a compatibility field, scan both producers and normalization/serialization consumers before running the first build.
- References (paths/commands/log keywords):
  - `src/backend/runtime/types.ts`
  - `src/backend/runtime/persona-observation.ts`
  - `pnpm typecheck`
