# 00 Overview — launch-runtime-mode-and-kickoff-alignment (T-998)

## Status
- State: done
- Depends on: T-995 kickoff-step3-live-run-v4-100-slots, T-996 launch-enrichment-product-safe-chronicle, and T-997 launch-invalid-content-cleanup.
- Current status: runtime mode persistence, promote cutover semantics, kickoff truth sync, and cleanup-before-enrichment rollout guidance are implemented. Targeted runtime/governance tests passed; full repo `typecheck` and `pnpm test` remain blocked by unrelated pre-existing workspace issues recorded in verification.
- Next step: none inside this task.

## Goal
Align kickoff completion truth, runtime mode control, promote semantics, and enrichment/cleanup rollout guidance without lowering kickoff or warmup readiness standards.

## Non-goals
- Do not redesign `launch.kickoff` into an ECS-only command.
- Do not relax kickoff or warmup verification floors.
- Do not merge cleanup behavior into `launch.enrichment`.

## Acceptance Criteria
- [x] Kickoff baseline persistence carries explicit runtime mode and force-override metadata.
- [x] Runtime admission exposes natural vs forced growth state while preserving `allow_public_growth` compatibility.
- [x] `launch.kickoff` sets imported baselines to `warmup_only`, and autonomous posting remains blocked until promote.
- [x] Standard `launch.gray.promote` naturally switches runtime to `autonomous` when all gates are green.
- [x] Force promote supports `--reason` and a default 24h override TTL.
- [x] Admin runtime stats expose runtime mode and active override details.
- [x] T-995 docs reflect operator-confirmed Step 4–6 completion and note the missing local `.ai/.tmp/kickoff*` artifacts in this workspace.
- [x] Rollout docs explicitly sequence cleanup before enrichment when synthetic lazy/mock derived content exists.
